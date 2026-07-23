# Aura Marketing Site — Pro Max Rebuild Plan

## New Dependencies
```
lenis                    → Buttery smooth scroll
gsap                     → Advanced scroll timelines + ScrollTrigger
@react-three/fiber       → Three.js React renderer
@react-three/drei        → Three.js helpers (Float, MeshDistortMaterial, etc.)
three                    → Three.js core
```

## Architecture Changes

### New Provider Layer
```
src/app/layout.tsx
  └─ <SmoothScrollProvider>   ← Lenis smooth scroll
       └─ <CustomCursor />    ← Magnetic cursor with glow
       └─ {children}
```

### New Components to Create
| File | Purpose |
|---|---|
| `components/providers/SmoothScrollProvider.tsx` | Lenis smooth scroll + GSAP ScrollTrigger integration |
| `components/ui/CustomCursor.tsx` | Magnetic cursor, glow trail, hover state changes |
| `components/ui/MagneticElement.tsx` | HOC — any element gets magnetic pull on hover |
| `components/ui/TextReveal.tsx` | Clip-path + translateY word-by-word reveal |
| `components/ui/ParallaxLayer.tsx` | Scroll-linked parallax depth layer |
| `components/three/BackgroundScene.tsx` | Three.js animated background (floating orbs, particles) |
| `components/three/FloatingGeometry.tsx` | Animated 3D shapes (torus, icosahedron, etc.) |
| `components/landing/VideoDemo.tsx` | NEW section — embedded product demo video |

### Files to FULLY REPLACE
| File | What Changes |
|---|---|
| `app/globals.css` | Add grain texture, glass morphism, cursor styles, premium keyframes, clip-path utilities |
| `components/landing/Hero.tsx` | Complete rebuild — video demo, Three.js bg, char-by-char headline, magnetic CTAs |
| `components/landing/FeatureGrid.tsx` | 3D tilt cards with perspective transforms, cursor-following glow |
| `components/landing/Stats.tsx` | Particle/dot background, animated counters with spring physics |
| `components/landing/Testimonials.tsx` | Drag carousel with momentum, 3D card stack, auto-play |
| `components/landing/PricingPreview.tsx` | 3D perspective hover, breathing glow on popular tier |
| `components/landing/CTASection.tsx` | Rebuild with parallax, floating orbs, magnetic CTA |
| `components/layout/Navbar.tsx` | Enhanced glass morphism, animated underline on active link |
| `lib/animations.ts` | Add new premium variants: clipPathReveal, textSlideUp, parallaxDepth, springHover |

### Files to UPGRADE (not replace)
| File | Changes |
|---|---|
| `components/landing/LogoCloud.tsx` | Infinite marquee with momentum, parallax speed differential |
| `components/landing/ProblemSolution.tsx` | Clip-path diagonal reveal, icon animations |
| `components/landing/HowItWorks.tsx` | Step-by-step scroll-linked timeline reveal |
| `components/landing/IntegrationLogos.tsx` | Subtle float animation, hover glow |
| `app/page.tsx` | Add VideoDemo section, adjust section order |
| `app/layout.tsx` | Wrap with SmoothScrollProvider, add CustomCursor |

## Animation Techniques Per Section

### Hero (FULL REBUILD)
- **Background:** Three.js scene with floating distorted spheres + gradient mesh
- **Headline:** `TextReveal` — each word slides up from below with clip-path mask, staggered 0.12s
- **Subheadline:** Fade in with y:20, delay 0.6s
- **CTAs:** `MagneticElement` — buttons pull toward cursor on hover
- **Mockup:** Real product demo video in floating browser frame with perspective tilt
- **Scroll indicator:** Breathing circle animation at bottom
- **Floating elements:** 3D objects orbiting the mockup (via Three.js)

### Feature Grid (3D TILT)
- **Container:** Perspective wrapper (`perspective: 1000px`)
- **Cards:** `rotateX`/`rotateY` following cursor position (max ±8°)
- **Glow:** Radial gradient overlay follows cursor position
- **Hover:** Scale 1.02 + shadow depth increase + border glow
- **Entrance:** Stagger from bottom with spring physics

### Stats (IMMERSIVE)
- **Background:** Dot grid with parallax depth layers
- **Numbers:** Custom spring-animated counters (not linear easing)
- **Container:** Slight parallax (moves slower than scroll)
- **Decorative:** Floating gradient orbs with `FloatingGeometry` from Three.js

### Testimonials (PREMIUM CAROUSEL)
- **Card Stack:** 3D depth — cards behind are scaled down + blurred
- **Drag:** Momentum-based drag with snap-to-card
- **Auto-play:** Advances every 5s, pauses on hover
- **Transition:** Cards rotate slightly in 3D during transition
- **Background:** Subtle gradient shift per testimonial

### Pricing (3D PERSPECTIVE)
- **Cards:** Perspective tilt on hover (less aggressive than features)
- **Popular tier:** Breathing glow border animation + floating "Most Popular" badge
- **Toggle:** Spring-animated knob with bounce
- **Comparison table:** Rows slide in from left on scroll

### CTA Section (PARALLAX)
- **Background:** Gradient mesh with parallax scroll speed
- **Text:** Oversized display heading with clip-path reveal
- **Floating orbs:** 3 Three.js floating spheres with distortion material
- **Button:** Magnetic pull + glow trail on hover

### New: VideoDemo Section
- **Layout:** Full-bleed dark section
- **Video:** HTML5 `<video>` element with local file, auto-play muted loop
- **Frame:** Floating browser chrome (dots + URL bar)
- **Caption:** Animated text below video
- **Background:** Gradient from navy to black

## Visual Polish
| Effect | Implementation |
|---|---|
| Film grain | CSS pseudo-element with repeating noise SVG |
| Glass morphism | `backdrop-blur-xl bg-white/60 border border-white/20` |
| Cursor glow | Radial gradient div following cursor with `mix-blend-mode` |
| Clip-path reveals | `clip-path: inset(100% 0 0 0)` → `inset(0 0 0 0)` |
| Spring physics | `type: "spring", stiffness: 300, damping: 30` |
| Scroll-linked opacity | `useScroll` + `useTransform` for section fade |
| Parallax depth | Multiple layers at different scroll speeds (0.2, 0.5, 0.8) |
| Magnetic pull | Spring-based cursor offset toward element center |
| 3D card tilt | `rotateY((cursorX - center) / width * maxAngle)` |
| Breathing glow | `box-shadow` keyframe with scale oscillation |

## Section Order on Landing Page
```
1. Hero (Three.js bg + video demo + char-reveal headline)
2. LogoCloud (infinite marquee)
3. VideoDemo (NEW — product walkthrough)
4. ProblemSolution (clip-path reveal)
5. FeatureGrid (3D tilt cards)
6. Stats (immersive counters)
7. HowItWorks (scroll-linked timeline)
8. Testimonials (3D carousel)
9. PricingPreview (3D perspective)
10. IntegrationLogos (float + glow)
11. CTASection (parallax + magnetic)
```

## Build Order
1. Install dependencies (lenis, gsap, three, @react-three/fiber, @react-three/drei)
2. Create SmoothScrollProvider + CustomCursor + MagneticElement + TextReveal
3. Create Three.js BackgroundScene + FloatingGeometry
4. Update globals.css with premium effects
5. Update animations.ts with new variants
6. Update layout.tsx with providers + cursor
7. Replace Hero.tsx (complete rebuild)
8. Replace FeatureGrid.tsx (3D tilt)
9. Replace Stats.tsx (immersive)
10. Replace Testimonials.tsx (3D carousel)
11. Replace PricingPreview.tsx (3D perspective)
12. Replace CTASection.tsx (parallax)
13. Create VideoDemo.tsx (new section)
14. Upgrade remaining sections (LogoCloud, ProblemSolution, HowItWorks, etc.)
15. Update page.tsx with new section order
16. Build + verify
