import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /cart
router.get('/', authenticate, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.image_url, p.stock
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = $1
  `, [req.user.id]);
  const total = rows.reduce((sum, r) => sum + r.price * r.quantity, 0);
  res.json({ items: rows, total: +total.toFixed(2) });
});

// PUT /cart — add or update item
router.put('/', authenticate, async (req, res) => {
  const { product_id, quantity } = req.body;
  if (!product_id || quantity == null) return res.status(400).json({ error: 'product_id and quantity required' });
  if (quantity < 1) return res.status(400).json({ error: 'quantity must be >= 1' });

  const { rows: prod } = await pool.query('SELECT id, stock FROM products WHERE id = $1', [product_id]);
  if (!prod[0]) return res.status(404).json({ error: 'Product not found' });
  if (quantity > prod[0].stock) return res.status(400).json({ error: 'Not enough stock' });

  await pool.query(`
    INSERT INTO cart_items (user_id, product_id, quantity)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
  `, [req.user.id, product_id, quantity]);

  res.json({ message: 'Cart updated' });
});

// DELETE /cart/:product_id
router.delete('/:product_id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [req.user.id, req.params.product_id]);
  res.status(204).send();
});

// DELETE /cart — clear cart
router.delete('/', authenticate, async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
  res.status(204).send();
});

export default router;
