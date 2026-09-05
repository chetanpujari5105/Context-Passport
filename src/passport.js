import { extractWithSource } from './extract.js';
import { renderHandoff, writeHandoff } from './render.js';

export function exportPassport({ cwd = process.cwd(), tool } = {}) {
  const { passport, adapterName, sourcePath } = extractWithSource({ cwd, tool });
  const markdown = renderHandoff(passport, { sourceTool: adapterName });
  const outputPath = writeHandoff(markdown, cwd);
  return { passport, adapterName, sourcePath, markdown, outputPath };
}
