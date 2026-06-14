import pool from './pool.js';
import bcrypt from 'bcryptjs';

const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Admin user
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('admin@example.com', $1, 'Admin User', 'admin')
      ON CONFLICT (email) DO NOTHING;
    `, [hash]);

    // Sample customer
    const customerHash = await bcrypt.hash('customer123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES ('customer@example.com', $1, 'Jane Doe', 'customer')
      ON CONFLICT (email) DO NOTHING;
    `, [customerHash]);

    // Sample products
    const products = [
      { name: 'Wireless Headphones', description: 'Premium noise-cancelling headphones', price: 199.99, stock: 50, category: 'Electronics', image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400' },
      { name: 'Leather Wallet', description: 'Slim genuine leather bifold wallet', price: 49.99, stock: 100, category: 'Accessories', image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400' },
      { name: 'Running Shoes', description: 'Lightweight performance running shoes', price: 129.99, stock: 75, category: 'Footwear', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400' },
      { name: 'Ceramic Coffee Mug', description: 'Handcrafted 12oz ceramic mug', price: 24.99, stock: 200, category: 'Kitchen', image_url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400' },
      { name: 'Mechanical Keyboard', description: 'Compact TKL mechanical keyboard', price: 149.99, stock: 30, category: 'Electronics', image_url: 'https://unsplash.com/photos/ZByWaPXD2fU/&w=1920' },
      { name: 'Canvas Backpack', description: 'Durable everyday carry backpack', price: 79.99, stock: 60, category: 'Accessories', image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400' },
    ];

    for (const p of products) {
      await client.query(`
        INSERT INTO products (name, description, price, stock, category, image_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING;
      `, [p.name, p.description, p.price, p.stock, p.category, p.image_url]);
    }

    await client.query('COMMIT');
    console.log('✅ Seed complete');
    console.log('   admin@example.com / admin123');
    console.log('   customer@example.com / customer123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
