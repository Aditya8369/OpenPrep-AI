import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import TopicMasteryDrawer from './TopicMasteryDrawer';
import { DEFAULT_SYLLABUS, getMasteryColor } from './SyllabusSunburstData';

export { DEFAULT_SYLLABUS, getMasteryColor };

/**
 * Calculates SVG arc path string
 */
function describeArc(cx, cy, innerRadius, outerRadius, startAngle, endAngle) {
  const isFullCircle = endAngle - startAngle >= 2 * Math.PI - 0.001;
  const effectiveEnd = isFullCircle ? startAngle + 2 * Math.PI - 0.001 : endAngle;

  const startXOuter = cx + outerRadius * Math.cos(startAngle);
  const startYOuter = cy + outerRadius * Math.sin(startAngle);
  const endXOuter = cx + outerRadius * Math.cos(effectiveEnd);
  const endYOuter = cy + outerRadius * Math.sin(effectiveEnd);

  const startXInner = cx + innerRadius * Math.cos(startAngle);
  const startYInner = cy + innerRadius * Math.sin(startAngle);
  const endXInner = cx + innerRadius * Math.cos(effectiveEnd);
  const endYInner = cy + innerRadius * Math.sin(effectiveEnd);

  const largeArcFlag = effectiveEnd - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${startXInner} ${startYInner}`,
    `L ${startXOuter} ${startYOuter}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endXOuter} ${endYOuter}`,
    `L ${endXInner} ${endYInner}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startXInner} ${startYInner}`,
    'Z',
  ].join(' ');
}

export const SyllabusSunburstChart = ({ syllabusData = DEFAULT_SYLLABUS, className = '', onSelectTopic }) => {
  const data = (syllabusData && syllabusData.length > 0) ? syllabusData : DEFAULT_SYLLABUS;

  const [activeNode, setActiveNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Layout parameters
  const size = 440;
  const cx = size / 2;
  const cy = size / 2;

  const ringRadius = {
    tier1: { inner: 45, outer: 88 },   // Subjects
    tier2: { inner: 92, outer: 142 },  // Chapters
    tier3: { inner: 146, outer: 204 }, // Subtopics
  };

  // Compute sectors hierarchically
  const sectors = useMemo(() => {
    const list = [];
    const totalWeight = data.reduce((acc, subj) => acc + (subj.weightage || 1), 0);
    let currentAngle = -Math.PI / 2; // start from top (12 o'clock)

    data.forEach((subj) => {
      const subjAngleSpan = ((subj.weightage || 1) / totalWeight) * (2 * Math.PI);
      const subjStart = currentAngle;
      const subjEnd = currentAngle + subjAngleSpan;

      list.push({
        ...subj,
        tier: 1,
        tierName: 'Subject',
        startAngle: subjStart,
        endAngle: subjEnd,
        innerR: ringRadius.tier1.inner,
        outerR: ringRadius.tier1.outer,
      });

      const chapters = subj.children || [];
      const chapTotalWeight = chapters.reduce((acc, c) => acc + (c.weightage || 1), 0) || 1;
      let chapCurrentAngle = subjStart;

      chapters.forEach((chap) => {
        const chapAngleSpan = ((chap.weightage || 1) / chapTotalWeight) * subjAngleSpan;
        const chapStart = chapCurrentAngle;
        const chapEnd = chapCurrentAngle + chapAngleSpan;

        list.push({
          ...chap,
          parentName: subj.name,
          tier: 2,
          tierName: 'Chapter',
          startAngle: chapStart,
          endAngle: chapEnd,
          innerR: ringRadius.tier2.inner,
          outerR: ringRadius.tier2.outer,
        });

        const topics = chap.children || [];
        const topTotalWeight = topics.reduce((acc, t) => acc + (t.weightage || 1), 0) || 1;
        let topCurrentAngle = chapStart;

        topics.forEach((top) => {
          const topAngleSpan = ((top.weightage || 1) / topTotalWeight) * chapAngleSpan;
          const topStart = topCurrentAngle;
          const topEnd = topCurrentAngle + topAngleSpan;

          list.push({
            ...top,
            parentName: `${subj.name} > ${chap.name}`,
            tier: 3,
            tierName: 'Sub-topic',
            startAngle: topStart,
            endAngle: topEnd,
            innerR: ringRadius.tier3.inner,
            outerR: ringRadius.tier3.outer,
          });

          topCurrentAngle = topEnd;
        });

        chapCurrentAngle = chapEnd;
      });

      currentAngle = subjEnd;
    });

    return list;
  }, [data]);

  const handleSectorClick = (sector) => {
    setActiveNode(sector);
    setIsDrawerOpen(true);
    if (onSelectTopic) {
      onSelectTopic(sector);
    }
  };

  const currentDisplayNode = hoveredNode || activeNode;

  return (
    <div className={`syllabus-sunburst-container bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm ${className}`} data-testid="syllabus-sunburst">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>🎯 Syllabus Mastery Sunburst</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Arc angle reflects historical PYQ exam weightage. Colors represent student mastery percentage.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>&lt;50% High Gap</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>50-75% In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>&gt;75% Mastered</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
        {/* SVG Sunburst Canvas */}
        <div className="relative flex items-center justify-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full max-w-[420px] h-auto drop-shadow-sm select-none"
            role="img"
            aria-label="Interactive Syllabus Sunburst Chart"
          >
            {/* Center Hub */}
            <circle
              cx={cx}
              cy={cy}
              r={ringRadius.tier1.inner - 4}
              className="fill-slate-100 dark:fill-slate-800 transition-colors"
            />
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              className="text-[12px] font-bold fill-neutral-800 dark:fill-neutral-100 font-sans"
            >
              {currentDisplayNode ? `${currentDisplayNode.mastery}%` : 'Syllabus'}
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              className="text-[9px] fill-neutral-500 dark:fill-neutral-400 font-sans uppercase tracking-wider font-semibold"
            >
              {currentDisplayNode ? 'Mastery' : 'PYQ Explorer'}
            </text>

            {/* Hierarchical Sector Paths */}
            {sectors.map((sector) => {
              const pathData = describeArc(
                cx,
                cy,
                sector.innerR,
                sector.outerR,
                sector.startAngle,
                sector.endAngle
              );
              const color = getMasteryColor(sector.mastery);
              const isHovered = hoveredNode?.id === sector.id;
              const isSelected = activeNode?.id === sector.id;

              return (
                <path
                  key={sector.id}
                  d={pathData}
                  fill={color}
                  stroke={isSelected ? '#3b82f6' : '#ffffff'}
                  strokeWidth={isSelected ? 2.5 : 1.2}
                  className="cursor-pointer transition-all duration-150 hover:opacity-90"
                  style={{
                    filter: isHovered ? 'brightness(1.15)' : 'none',
                    transformOrigin: `${cx}px ${cy}px`,
                  }}
                  onMouseEnter={() => setHoveredNode(sector)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleSectorClick(sector)}
                  data-testid={`sector-${sector.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${sector.name} (${sector.tierName}), Mastery ${sector.mastery}%, Weightage ${sector.weightage}%`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSectorClick(sector);
                    }
                  }}
                />
              );
            })}
          </svg>
        </div>

        {/* Live Hover/Detail Quick Inspect Card */}
        <div className="w-full lg:w-80 bg-neutral-50 dark:bg-slate-800/60 border border-neutral-200 dark:border-slate-700 rounded-xl p-4 self-stretch flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
              {currentDisplayNode ? currentDisplayNode.tierName : 'Quick Node Inspector'}
            </span>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1">
              {currentDisplayNode ? currentDisplayNode.name : 'Click any slice to inspect'}
            </h3>
            {currentDisplayNode?.parentName && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {currentDisplayNode.parentName}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-neutral-200 dark:border-slate-700/80">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Mastery</span>
                <p className="text-lg font-black text-gray-900 dark:text-gray-100">
                  {currentDisplayNode ? `${currentDisplayNode.mastery}%` : '--'}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-neutral-200 dark:border-slate-700/80">
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">PYQ Weightage</span>
                <p className="text-lg font-black text-gray-900 dark:text-gray-100">
                  {currentDisplayNode ? `${currentDisplayNode.weightage}%` : '--'}
                </p>
              </div>
            </div>

            {currentDisplayNode?.pyqFrequency && (
              <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-xs text-blue-700 dark:text-blue-300 font-medium">
                📊 {currentDisplayNode.pyqFrequency}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (currentDisplayNode) {
                setActiveNode(currentDisplayNode);
                setIsDrawerOpen(true);
              }
            }}
            disabled={!currentDisplayNode}
            className="w-full mt-4 py-2 px-3 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white transition shadow-sm"
          >
            Open Comprehensive Breakdown
          </button>
        </div>
      </div>

      {/* Slide-over Topic Detail Drawer */}
      <TopicMasteryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        topicData={activeNode}
      />
    </div>
  );
};

SyllabusSunburstChart.propTypes = {
  syllabusData: PropTypes.arrayOf(PropTypes.object),
  className: PropTypes.string,
  onSelectTopic: PropTypes.func,
};

export default SyllabusSunburstChart;
