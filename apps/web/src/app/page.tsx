import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-6xl font-bold tracking-tight">One Stack</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          A modern full-stack monorepo template using Turborepo, shadcn/ui,
          Prisma, and Biome.
        </p>
        <div className="flex gap-4">
          <Button size="lg">Get Started</Button>
          <Button variant="outline" size="lg">
            Learn More
          </Button>
        </div>
      </main>
    </div>
  );
}
