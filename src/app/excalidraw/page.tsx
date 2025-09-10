'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamicImport from 'next/dynamic';

import DiagramModal from './_components/DiagramModal';

import { useExcalidrawMessage } from '@/hooks/useExcalidraw';

import '@excalidraw/excalidraw/index.css';

export const dynamic = 'force-dynamic';

// 动态导入 Excalidraw，避免 SSR 问题
const Excalidraw = dynamicImport(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">正在加载 Excalidraw...</p>
      </div>
    </div>
  ),
});

export default function ExcalidrawPage() {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 动态导入的函数
  const [excalidrawUtils, setExcalidrawUtils] = useState<any>(null);

  // 模态框状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 导出状态
  const [isExporting, setIsExporting] = useState(false);

  // 动态加载 Excalidraw 相关的工具函数
  useEffect(() => {
    if (typeof window !== 'undefined') {
      Promise.all([import('@excalidraw/mermaid-to-excalidraw'), import('@excalidraw/excalidraw')])
        .then(([mermaidModule, excalidrawModule]) => {
          setExcalidrawUtils({
            parseMermaidToExcalidraw: mermaidModule.parseMermaidToExcalidraw,
            convertToExcalidrawElements: excalidrawModule.convertToExcalidrawElements,
            exportToSvg: excalidrawModule.exportToSvg,
          });
        })
        .catch((err) => {
          console.error('Failed to load Excalidraw modules:', err);
          setError('加载绘图工具失败，请刷新页面重试');
        });
    }
  }, []);

  // 渲染 Mermaid 代码为 Excalidraw 图表
  const renderMermaidToExcalidraw = useCallback(
    async (code: string) => {
      if (!excalidrawAPI || !code.trim() || !excalidrawUtils) {
        if (excalidrawAPI) {
          excalidrawAPI.updateScene({ elements: [] });
        }

        return;
      }

      setIsRendering(true);
      setError(null);

      try {
        const { elements } = await excalidrawUtils.parseMermaidToExcalidraw(code);
        const convertedElements = excalidrawUtils.convertToExcalidrawElements(elements);
        excalidrawAPI.updateScene({ elements: convertedElements });
        setTimeout(() => {
          if (convertedElements.length > 0) {
            excalidrawAPI.scrollToContent(convertedElements, { fitToContent: true });
          }
        }, 200);
      } catch (err) {
        setError(err instanceof Error ? err.message : '渲染失败，请检查代码格式');
      } finally {
        setIsRendering(false);
      }
    },
    [excalidrawAPI, excalidrawUtils],
  );

  // 从模态框生成图表
  const handleModalGenerate = (code: string) => {
    renderMermaidToExcalidraw(code);
  };

  // 清空画布
  const handleClear = () => {
    setError(null);

    if (excalidrawAPI) {
      excalidrawAPI.updateScene({ elements: [] });
    }
  };

  // 导出SVG功能
  const { sendExportMessage } = useExcalidrawMessage({
    origin: typeof window !== 'undefined' ? window.location.origin : '*',
  });

  const handleExportSVG = async () => {
    if (!excalidrawAPI || !excalidrawUtils) {
      setError('画布未初始化，请稍后重试');

      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();

      if (!elements || elements.length === 0) {
        setError('画布为空，请先创建一些图表内容');
        setIsExporting(false);

        return;
      }

      const svg = await excalidrawUtils.exportToSvg({
        elements,
        appState: { ...appState, exportBackground: true, exportWithDarkMode: false },
        files: null,
      });
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const fileName = `diagram-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.svg`;
      // 触发下载
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      // === 新增 postMessage 事件 ===
      sendExportMessage(svgData, fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SVG导出失败，请稍后重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Excalidraw 图表编辑器</h1>
          <p className="text-sm text-gray-500">创建和编辑 Mermaid 流程图</p>
        </div>
        <div className="flex items-center gap-3">
          {(isRendering || isExporting) && (
            <div className="flex items-center text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              <span className="text-sm">{isRendering ? '渲染中...' : '导出中...'}</span>
            </div>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!excalidrawUtils}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <span>⚡</span>
            图表生成器
          </button>
          <button
            onClick={handleExportSVG}
            disabled={isExporting || !excalidrawUtils}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <span>📥</span>
            导出 SVG
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            🗑️ 清空画布
          </button>
        </div>
      </div>
      {/* 错误提示 */}
      {
        error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )
      }

      {/* 加载提示 */}
      {!excalidrawUtils && (
        <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-600 text-sm">正在加载绘图工具...</p>
        </div>
      )}

      {/* Excalidraw 画布 */}
      <div className="flex-1 relative" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        <div className="absolute inset-0">
          <Excalidraw
            excalidrawAPI={(api: any) => {
              setExcalidrawAPI(api);
            }}
            initialData={{
              elements: [],
              appState: {
                viewBackgroundColor: '#ffffff',
              },
            }}
          />
        </div>
      </div>
      {/* 模态框 */}
      <DiagramModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGenerate={handleModalGenerate}
      />
    </div >
  );
}
