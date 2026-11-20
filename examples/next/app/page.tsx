import { FlowHero } from 'flow-hero/react';

// A server component page: flow-hero/react carries 'use client', so no wrapper is needed.
export default function Page() {
  return (
    <FlowHero as="section" preset="ember" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'white' }}>
      <h1 style={{ fontSize: 56, letterSpacing: '-0.03em' }}>Your headline</h1>
    </FlowHero>
  );
}
