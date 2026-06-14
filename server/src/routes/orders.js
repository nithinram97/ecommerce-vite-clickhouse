import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// POST /orders — checkout: converts cart to order
router.post('/', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: cartItems } = await client.query(`
      SELECT ci.quantity, p.id as product_id, p.price, p.stock, p.name
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = $1
    `, [req.user.id]);

    if (!cartItems.length) return res.status(400).json({ error: 'Cart is empty' });

    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `"${item.name}" has insufficient stock` });
      }
    }

    const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const { rows: [order] } = await client.query(
      `INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING *`,
      [req.user.id, total.toFixed(2)]
    );

    for (const item of cartItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)`,
        [order.id, item.product_id, item.quantity, item.price]
      );
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    await client.query('COMMIT');

    const { rows: items } = await pool.query(`
      SELECT oi.*, p.name, p.image_url FROM order_items oi JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1
    `, [order.id]);

    res.status(201).json({ ...order, items });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    client.release();
  }
});

// GET /orders — current user's orders (admin sees all)
router.get('/', authenticate, async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { rows } = await pool.query(
    isAdmin
      ? `SELECT o.*, u.name as customer_name, u.email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC`
      : `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    isAdmin ? [] : [req.user.id]
  );
  res.json(rows);
});

// GET /orders/:id
router.get('/:id', authenticate, async (req, res) => {
  const { rows: [order] } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { rows: items } = await pool.query(`
    SELECT oi.*, p.name, p.image_url FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = $1
  `, [order.id]);
  res.json({ ...order, items });
});

// PATCH /orders/:id/status — admin only
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });

  const { rows: [order] } = await pool.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

export default router;
