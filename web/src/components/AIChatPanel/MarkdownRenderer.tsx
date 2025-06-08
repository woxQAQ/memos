import React, { useEffect, useState } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
  const [processedContent, setProcessedContent] = useState<string>("");
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);

  const escapeHtml = (text: string): string => {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  };

  const renderMathFallback = (formula: string, isBlock: boolean): string => {
    const escapedFormula = escapeHtml(formula);
    const prefix = isBlock ? "$$" : "$";
    const suffix = isBlock ? "$$" : "$";
    return `<span class="katex-fallback font-mono text-sm bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">${prefix}${escapedFormula}${suffix}</span>`;
  };

  const renderCodeBlock = (code: string, lang: string): string => {
    if (!highlighter) {
      // Fallback if highlighter is not ready
      return `<pre class="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm text-gray-900 dark:text-gray-100 whitespace-pre">${escapeHtml(code.trim())}</code></pre>`;
    }

    try {
      const isDark = document.documentElement.classList.contains("dark");
      const theme = isDark ? "github-dark" : "github-light";

      const highlighted = highlighter.codeToHtml(code.trim(), {
        lang: lang || "text",
        theme,
      });

      // Apply custom styling to the generated HTML
      return highlighted
        .replace(
          /<pre[^>]*>/,
          '<pre class="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 my-4 overflow-x-auto">',
        )
        .replace(/<code[^>]*>/, '<code class="text-sm whitespace-pre">');
    } catch (error) {
      console.error("Failed to highlight code:", error);
      // Fallback to plain text
      return `<pre class="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm text-gray-900 dark:text-gray-100 whitespace-pre">${escapeHtml(code.trim())}</code></pre>`;
    }
  };

  const processMarkdown = (text: string): string => {
    let html = text;

    // 保护特殊块
    const preservedBlocks: Array<{ placeholder: string; content: string }> = [];
    let blockIndex = 0;

    // 保护代码块
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__PRESERVED_BLOCK_${blockIndex}__`;
      preservedBlocks.push({
        placeholder,
        content: renderCodeBlock(code, lang),
      });
      blockIndex++;
      return placeholder;
    });

    // 保护行内代码
    html = html.replace(/`([^`\n]+)`/g, (match, code) => {
      const placeholder = `__PRESERVED_BLOCK_${blockIndex}__`;
      preservedBlocks.push({
        placeholder,
        content: `<code class="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-sm font-mono text-gray-900 dark:text-gray-100">${escapeHtml(code)}</code>`,
      });
      blockIndex++;
      return placeholder;
    });

    // 保护块级数学公式
    html = html.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
      const placeholder = `__PRESERVED_BLOCK_${blockIndex}__`;
      preservedBlocks.push({
        placeholder,
        content: `<div class="math-block-container my-4 text-center overflow-x-auto">${renderMathFallback(formula.trim(), true)}</div>`,
      });
      blockIndex++;
      return placeholder;
    });

    // 保护行内数学公式
    html = html.replace(/\$([^$\n]+)\$/g, (match, formula) => {
      const placeholder = `__PRESERVED_BLOCK_${blockIndex}__`;
      preservedBlocks.push({
        placeholder,
        content: renderMathFallback(formula.trim(), false),
      });
      blockIndex++;
      return placeholder;
    });

    // 转义 HTML
    html = escapeHtml(html);

    // 处理标题
    html = html.replace(/^###### (.*$)/gm, '<h6 class="text-sm font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h6>');
    html = html.replace(/^##### (.*$)/gm, '<h5 class="text-base font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h5>');
    html = html.replace(/^#### (.*$)/gm, '<h4 class="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h4>');
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-2xl font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h1>');

    // 处理粗体和斜体
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="font-bold"><em class="italic">$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

    // 处理删除线
    html = html.replace(/~~([^~]+)~~/g, '<del class="line-through text-gray-600 dark:text-gray-400">$1</del>');

    // 处理链接
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">$1</a>',
    );

    // 处理无序列表
    html = html.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li class="ml-4 list-disc text-gray-900 dark:text-gray-100">$1</li>');
    html = html.replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, '<ul class="list-disc list-inside space-y-1 my-2 ml-4">$1</ul>');

    // 处理有序列表
    html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li class="ml-4 text-gray-900 dark:text-gray-100">$1</li>');
    html = html.replace(/((?:<li[^>]*>(?!.*list-disc).*<\/li>\s*)+)/g, '<ol class="list-decimal list-inside space-y-1 my-2 ml-4">$1</ol>');

    // 处理引用
    html = html.replace(
      /^&gt;\s+(.*)$/gm,
      '<blockquote class="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 my-2 italic text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800">$1</blockquote>',
    );

    // 处理表格
    html = html.replace(/(\|[^\n]*\|\n)+/g, (match) => {
      const rows = match.trim().split("\n");
      if (rows.length < 2) return match;

      let tableHtml = '<div class="overflow-x-auto my-4 border border-gray-200 dark:border-gray-700 rounded-lg"><table class="min-w-full">';

      rows.forEach((row, index) => {
        if (row.trim() === "") return;

        // 跳过分隔行 (---|---|---)
        if (row.match(/^\s*\|[\s:|-]+\|\s*$/)) return;

        const cells = row.split("|").slice(1, -1); // 移除首尾空元素
        const isHeader = index === 0;

        if (isHeader) {
          tableHtml += '<thead class="bg-gray-50 dark:bg-gray-800">';
          tableHtml += "<tr>";
          cells.forEach((cell) => {
            tableHtml += `<th class="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">${cell.trim()}</th>`;
          });
          tableHtml += "</tr>";
          tableHtml += "</thead>";
          tableHtml += '<tbody class="divide-y divide-gray-200 dark:divide-gray-700">';
        } else {
          tableHtml += '<tr class="bg-gray-50 dark:bg-gray-800">';
          cells.forEach((cell) => {
            tableHtml += `<td class="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">${cell.trim()}</td>`;
          });
          tableHtml += "</tr>";
        }
      });

      tableHtml += "</tbody></table></div>";
      return tableHtml;
    });

    // 处理水平线
    html = html.replace(/^---+$/gm, '<hr class="border-gray-300 dark:border-gray-600 my-4" />');

    // 处理换行
    html = html.replace(/\n\n+/g, "</p><p class='my-2 text-gray-900 dark:text-gray-100'>");
    html = html.replace(/\n/g, "<br/>");

    // 包装段落
    if (
      html &&
      !html.includes("<h") &&
      !html.includes("<ul") &&
      !html.includes("<ol") &&
      !html.includes("<pre") &&
      !html.includes("<blockquote")
    ) {
      html = `<p class="my-2 text-gray-900 dark:text-gray-100">${html}</p>`;
    }

    // 恢复保护的块
    preservedBlocks.forEach(({ placeholder, content }) => {
      html = html.replace(placeholder, content);
    });

    return html;
  };

  useEffect(() => {
    // Initialize shiki highlighter
    const initHighlighter = async () => {
      try {
        const shiki = await createHighlighter({
          themes: ["github-light", "github-dark"],
          langs: [
            "javascript",
            "typescript",
            "python",
            "java",
            "cpp",
            "c",
            "csharp",
            "php",
            "ruby",
            "go",
            "rust",
            "swift",
            "kotlin",
            "scala",
            "html",
            "css",
            "scss",
            "json",
            "xml",
            "yaml",
            "markdown",
            "bash",
            "shell",
            "sql",
            "dockerfile",
            "nginx",
          ],
        });
        setHighlighter(shiki);
      } catch (error) {
        console.error("Failed to initialize shiki:", error);
      }
    };

    initHighlighter();
  }, []);

  useEffect(() => {
    setProcessedContent(processMarkdown(content));
  }, [content, highlighter]);

  return (
    <div
      className={`markdown-content prose prose-sm max-w-none dark:prose-invert ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
};

export default MarkdownRenderer;
