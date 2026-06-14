import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /products — list with optional category filter & search
router.get('/', async (req, res) => {
  const { category, q, page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
  if (q)        { params.push(`%${q}%`); conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM products ${where}`, params.slice(0, -2));

  res.json({ products: rows, total: parseInt(countRows[0].count), page: +page, limit: +limit });
});

// GET /products/categories
router.get('/categories', async (_req, res) => {
  const { rows } = await pool.query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category');
  res.json(rows.map(r => r.category));
});

// GET /products/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(rows[0]);
});

// POST /products — admin only
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, description, price, stock, image_url, category } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  const { rows } = await pool.query(
    `INSERT INTO products (name, description, price, stock, image_url, category)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, description, price, stock ?? 0, image_url, category]
  );
  res.status(201).json(rows[0]);
});

// PATCH /products/:id — admin only
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  const fields = ['name', 'description', 'price', 'stock', 'image_url', 'category'];
  const updates = fields.filter(f => req.body[f] !== undefined);
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

  const params = updates.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = updates.map(f => req.body[f]);
  values.push(req.params.id);

  const { rows } = await pool.query(
    `UPDATE products SET ${params} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(rows[0]);
});

// DELETE /products/:id — admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Product not found' });
  res.status(204).send();
});

export default router;
