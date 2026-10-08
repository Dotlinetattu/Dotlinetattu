import Image from "next/image";
import Link from "next/link";

export default function About() {
  return (
    <div className="pt-32 pb-24 w-full flex flex-col items-center">
      <div className="container mx-auto px-4 md:px-8 max-w-5xl">
        
        {/* Header */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h3 className="text-accent font-heading tracking-widest text-sm uppercase mb-4">The Story Behind The Ink</h3>
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-primary uppercase tracking-wider mb-6">
            Silver Jerry
          </h1>
          <div className="w-24 h-1 bg-accent mx-auto"></div>
        </div>

        {/* Content Section 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
          <div className="relative aspect-[3/4] rounded-sm overflow-hidden border border-border">
            <Image 
              src="/assets/Gallery/tattoo-artist-bali-2.webp"
              alt="Jerry Tattooing" 
              fill
              className="object-cover transition-all duration-700"
            />
          </div>
          <div className="space-y-6 text-secondary font-light leading-relaxed">
            <h2 className="text-2xl font-heading font-bold text-primary uppercase tracking-wide mb-4">
              A Decade of Dedication
            </h2>
            <p>
              The journey began in <strong>2010</strong>, driven by an undeniable pull towards the art of permanent expression. By <strong>2015</strong>, Silver Jerry had firmly established his name in the tattoo community, dedicating his life to mastering both modern and ancient techniques.
            </p>
          </div>
        </div>

        {/* Content Section 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
          <div className="order-2 md:order-1">
            <h2 className="font-heading text-3xl md:text-5xl text-primary mb-6 uppercase tracking-wide">The Birth of Dotlinetattu</h2>
            <div className="space-y-6 text-secondary font-sans font-light leading-relaxed">
              <p>
                In <strong>2019</strong>, <em>Dotlinetattu</em> was born as a physical sanctuary in Bali. It was created with a rebellious spirit against the modern commercialization of tattoo studios. We wanted to restore the "Real Bali"—a place where art, connection, and culture hold more value than quick profits.
              </p>
              <p>
                Bali is an island of rich culture and deep history, and it deserves tattoo spaces that honor that spirit. Dotlinetattu is for those who seek meaning in their marks.
              </p>
            </div>
          </div>
          <div className="order-1 md:order-2 relative aspect-[4/3] border border-border">
            <Image src="/assets/Gallery/custom-geometric-ornament-lotus-flower-resilience-transformation-2.webp" alt="Dotlinetattu Studio Bali" fill className="object-cover" />
          </div>
        </div>

        {/* Content Section 3 */}
        <div className="text-center max-w-4xl mx-auto mb-24">
          <h2 className="font-heading text-3xl md:text-5xl text-primary mb-8 uppercase tracking-wide">Roots & Traditions</h2>
          <p className="text-secondary font-sans font-light leading-relaxed text-lg mb-8">
            When you get an authentic tattoo from Dotlinetattu by silver jerry, it is never just a transaction. It requires discussion, respect, and understanding. 
          </p>
          <p className="text-secondary font-sans font-light leading-relaxed text-lg">
            My heritage traces back to Sumatra (Lampung), but my artistic soul is deeply tied to the ancient tribal handpoke techniques of the Indonesian archipelago. Handpoke is not just a style; it's a rhythmic, traditional technique that connects the wearer to the earth and their ancestors. 
          </p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-primary text-xl font-heading mb-8">Ready to start your journey?</p>
          <Link 
            href="/services" 
            className="px-8 py-4 bg-accent hover:bg-accent-hover text-white transition-all duration-300 font-heading font-bold tracking-widest uppercase text-sm rounded-sm"
          >
            View Our Services
          </Link>
        </div>

      </div>
    </div>
  );
}
