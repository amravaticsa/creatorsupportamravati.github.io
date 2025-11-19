<!--
  File: index.html
  Purpose: Single-file, professional & premium GitHub Pages-ready website for
  "Creator Support Amravati". Drop this file at the root of a GitHub repo named
  `creatorsupportamravati.github.io` (or any repo and enable GitHub Pages) and the
  site will be live.

  Deployment (quick):
  1. Create a new GitHub repository named `creatorsupportamravati.github.io`.
  2. Commit and push this file as `index.html` to the repository's default branch.
  3. GitHub Pages will publish at: https://<your-username>.github.io/creatorsupportamravati.github.io/
     (or if you name the repo exactly `creatorsupportamravati.github.io` it'll be https://creatorsupportamravati.github.io/)
  4. To use a custom domain, add CNAME file or set the custom domain in repository settings.

  Notes:
  - Replace placeholder text (phone, email, address, portfolio images) with your real content.
  - The Google Analytics / gtag.js snippet you provided is included below — no extra steps needed besides publishing.
  - To verify Google Analytics: open Realtime > Overview in Google Analytics and visit the published site.

  Contact me if you want:
  - Separate CSS/JS files instead of single-file
  - Contact form that saves to Netlify/Formspark/FormSubmit
  - More pages (About, Pricing, Blog) or multilingual support
-->

<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="Creator Support Amravati - Professional photography, videography, and digital marketing services in Amravati" />
  <title>Creator Support Amravati • Professional Photography & Video</title>

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-ELW9G1E49F"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);} 
    gtag('js', new Date());

    gtag('config', 'G-ELW9G1E49F');
  </script>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700;800&display=swap" rel="stylesheet">

  <style>
    :root{
      --bg:#0b1220;    /* deep navy */
      --card:#0f1724;  /* slightly lighter */
      --accent:#f6c34a; /* gold */
      --muted:#9aa6ba;
      --glass: rgba(255,255,255,0.04);
      --radius:14px;
      font-family: 'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
      color-scheme: dark;
    }
    *{box-sizing:border-box}
    html,body{height:100%;margin:0;background:linear-gradient(180deg,#051021 0%,var(--bg) 100%);color:#e6eef8}
    a{color:var(--accent);text-decoration:none}
    header{padding:28px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px}
    .brand{display:flex;align-items:center;gap:14px}
    .logo{width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#ffd87a);display:flex;align-items:center;justify-content:center;color:#0b1220;font-weight:800;font-size:18px}
    .nav{display:flex;gap:14px;align-items:center}
    .btn{background:var(--accent);color:#071020;padding:10px 14px;border-radius:10px;font-weight:700}

    .container{max-width:1100px;margin:24px auto;padding:0 20px}

    .hero{display:grid;grid-template-columns:1fr 420px;gap:36px;align-items:center;margin-top:18px}
    .hero-card{background:linear-gradient(180deg, rgba(255,255,255,0.02), var(--glass));padding:28px;border-radius:var(--radius);box-shadow:0 8px 30px rgba(2,6,23,0.6)}
    h1{margin:0;font-size:34px;line-height:1.02}
    p.lead{color:var(--muted);margin-top:12px}

    .features{display:flex;gap:12px;margin-top:18px}
    .feature{background:rgba(255,255,255,0.02);padding:10px 12px;border-radius:12px;font-weight:600}

    /* Services */
    .services{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:28px}
    .service{background:var(--card);padding:18px;border-radius:12px;box-shadow:0 4px 18px rgba(2,6,23,0.5)}
    .service h3{margin:0 0 8px 0}
    .service p{margin:0;color:var(--muted);font-size:14px}

    /* Portfolio */
    .portfolio-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:20px}
    .port{height:140px;border-radius:10px;background-size:cover;background-position:center;position:relative;overflow:hidden}
    .port::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent,rgba(0,0,0,0.35))}

    /* Contact */
    .contact{display:flex;gap:18px;margin-top:26px}
    .contact .left{flex:1}
    .contact .card{padding:18px;border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent)}
    .form-row{display:flex;gap:10px;margin-top:10px}
    input,textarea{width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.05);background:transparent;color:inherit}
    button.primary{background:var(--accent);border:none;padding:10px 14px;border-radius:10px;font-weight:700}

    footer{margin-top:40px;padding:24px 0;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}

    /* responsive */
    @media (max-width:920px){
      .hero{grid-template-columns:1fr}
      header{flex-direction:column;align-items:flex-start;gap:10px}
    }
  </style>
</head>
<body>
  <header class="container">
    <div class="brand">
      <div class="logo">CSA</div>
      <div>
        <div style="font-weight:800;font-size:16px">Creator Support Amravati</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Photography • Videography • Digital Marketing</div>
      </div>
    </div>
    <nav class="nav">
      <a href="#services">Services</a>
      <a href="#portfolio">Portfolio</a>
      <a href="#pricing">Pricing</a>
      <a href="#contact" class="btn">Contact</a>
    </nav>
  </header>

  <main class="container">
    <section class="hero">
      <div class="hero-card">
        <h1>Cinematic wedding photography & premium brand visuals for Amravati.</h1>
        <p class="lead">We help couples and businesses tell beautiful stories — cinematic films, striking photos, and digital marketing that converts.</p>

        <div class="features">
          <div class="feature">Cinematic Storytelling</div>
          <div class="feature">Branded Campaigns</div>
          <div class="feature">Quick Turnaround</div>
        </div>

        <div class="services" id="services">
          <div class="service">
            <h3>Wedding Photography</h3>
            <p>Cinematic coverage, unlimited photos, professional retouching and premium albums.</p>
          </div>
          <div class="service">
            <h3>Wedding Films</h3>
            <p>Cinematic trailers, full-length films, and highlight reels shot with cinematic colour-graded style.</p>
          </div>
          <div class="service">
            <h3>Brand Videos</h3>
            <p>Product films, hotel promos, real estate walkthroughs and corporate storytelling.</p>
          </div>
          <div class="service">
            <h3>Digital Marketing</h3>
            <p>SEO, social media ads, content strategy and website design to grow enquiries.</p>
          </div>
        </div>

        <div style="margin-top:18px;display:flex;gap:12px;align-items:center">
          <a class="btn" href="#contact">Book a Free Call</a>
          <a style="font-weight:700;display:inline-block;padding:10px 12px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,0.05)">View Packages</a>
        </div>

        <div style="margin-top:18px;color:var(--muted);font-size:13px">Trusted by couples & small businesses in Amravati. Get a free quote — WhatsApp: <a href="tel:+919225515679">9225515679</a></div>
      </div>

      <aside style="width:100%;max-width:420px">
        <div class="hero-card" style="display:flex;flex-direction:column;gap:12px">
          <div style="font-weight:800">Quick Packages</div>
          <div style="display:flex;gap:8px;flex-direction:column">
            <div style="display:flex;justify-content:space-between;align-items:center"><div>Essential Shoot</div><div style="font-weight:800">₹5,000</div></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><div>Premium Wedding</div><div style="font-weight:800">₹45,000</div></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><div>Cinematic Film</div><div style="font-weight:800">Starts ₹25,000</div></div>
          </div>

          <div style="margin-top:8px;color:var(--muted);font-size:13px">Custom packages available. We'll design one to fit your event & budget.</div>
        </div>

        <div style="margin-top:12px;display:flex;gap:10px">
          <div style="flex:1;background:url('https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop&s=placeholder') center/cover;border-radius:10px;height:120px"></div>
          <div style="flex:1;background:url('https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?q=80&w=800&auto=format&fit=crop&s=placeholder') center/cover;border-radius:10px;height:120px"></div>
        </div>
      </aside>
    </section>

    <section id="portfolio">
      <h2 style="margin-top:30px">Portfolio — Recent Work</h2>
      <p style="color:var(--muted);margin-top:6px">Selected photos & short films showcasing our cinematic approach.</p>

      <div class="portfolio-grid" style="margin-top:12px">
        <div class="port" style="background-image:url('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1200&auto=format&fit=crop&s=placeholder')"></div>
        <div class="port" style="background-image:url('https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?q=80&w=1200&auto=format&fit=crop&s=placeholder')"></div>
        <div class="port" style="background-image:url('https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?q=80&w=1200&auto=format&fit=crop&s=placeholder')"></div>
        <div class="port" style="background-image:url('https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=1200&auto=format&fit=crop&s=placeholder')"></div>
      </div>
    </section>

    <section id="pricing" style="margin-top:26px">
      <h2>Pricing & Packages</h2>
      <p style="color:var(--muted)">Transparent pricing with optional add-ons — albums, drone, multi-day coverage, and priority editing.</p>

      <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
        <div class="service" style="min-width:220px;flex:1"> <h3>Starter</h3><p>₹5,000 — Short shoots, events, portraits</p></div>
        <div class="service" style="min-width:220px;flex:1"> <h3>Classic</h3><p>₹20,000 — Half-day, event coverage</p></div>
        <div class="service" style="min-width:220px;flex:1"> <h3>Premium</h3><p>₹45,000+ — Full wedding, album & films</p></div>
      </div>
    </section>

    <section id="contact" class="contact">
      <div class="left">
        <div class="card">
          <h3>Contact Us</h3>
          <p style="color:var(--muted)">Send a message or call/WhatsApp us for availability and a custom quote.</p>

          <form action="mailto:amravati.csa@gmail.com" method="post" enctype="text/plain" style="margin-top:12px">
            <div class="form-row">
              <input type="text" name="name" placeholder="Your name *" required>
              <input type="email" name="email" placeholder="Email *" required>
            </div>
            <div style="margin-top:10px">
              <input type="text" name="subject" placeholder="Subject">
            </div>
            <div style="margin-top:10px">
              <textarea name="message" placeholder="Message" rows="5"></textarea>
            </div>
            <div style="margin-top:10px;display:flex;gap:10px;align-items:center">
              <button class="primary" type="submit">Send Email</button>
              <a href="https://wa.me/919225515679" target="_blank" class="btn">WhatsApp</a>
            </div>
          </form>
        </div>

        <div style="margin-top:12px;color:var(--muted);font-size:14px">Or call: <a href="tel:+919225515679">9225515679</a> • Email: <a href="mailto:amravati.csa@gmail.com">amravati.csa@gmail.com</a></div>
      </div>

      <aside style="width:360px;max-width:100%">
        <div class="card" style="padding:18px">
          <div style="font-weight:800">Office</div>
          <div style="color:var(--muted);margin-top:6px">Mahendra Colony, Amravati • Visit by appointment</div>

          <div style="margin-top:12px;display:flex;gap:8px;font-size:14px;color:var(--muted)">
            <div style="flex:1">Mon–Sat<br/>9:30am–7pm</div>
            <div style="flex:1">Socials<br/><a href="#">Instagram</a><br/><a href="#">YouTube</a></div>
          </div>
        </div>

        <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);font-size:14px;color:var(--muted)">
          <strong>Free campaign:</strong> Limited free couple shoots — DM to register.
        </div>
      </aside>
    </section>

    <footer>
      <div>© Creator Support Amravati • Built with care</div>
      <div>Made in Amravati • <a href="#privacy">Privacy</a> • <a href="#terms">Terms</a></div>
    </footer>
  </main>

</body>
</html>
