import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

/** TeX rendered by KaTeX, with MathML alongside so screen readers can read it. */
export function Tex({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: block, throwOnError: true, output: 'htmlAndMathml' }),
    [tex, block],
  );
  return block ? (
    <div className="math-block" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}
