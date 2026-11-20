import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FlowHero } from '../src/react';

it('renders the requested element on the server and keeps its attributes', () => {
  const html = renderToString(createElement(FlowHero, { as: 'section', id: 'top', className: 'hero' }, createElement('h1', null, 'Hi')));
  expect(html).toMatch(/^<section id="top" class="hero">/);
  expect(html).toContain('<h1>Hi</h1>');
});

it('defaults to a div', () => {
  expect(renderToString(createElement(FlowHero, null))).toMatch(/^<div>/);
});
