import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
  return (
    <div className="home">
      <section className="hero container">
        <div className="hero-text">
          <h1>Quality goods,<br />delivered fast.</h1>
          <p>Browse our curated catalogue of electronics, accessories, footwear and more.</p>
          <Link to="/products" className="btn btn-primary hero-cta">Shop now →</Link>
        </div>
        <div className="hero-visual" />
      </section>
    </div>
  );
}
