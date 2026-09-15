import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';

const VARIANTS = {
  contained: {
    list: 'flex flex-wrap gap-1 bg-slate-900 border border-slate-700 rounded-2xl p-1',
    tab: 'px-3 sm:px-4 py-2 rounded-xl',
    active: 'bg-white text-slate-900 shadow-sm',
    inactive: 'text-slate-400 hover:text-slate-100',
    transition: 'transition-all',
  },
  page: {
    list: 'flex gap-1 border-b border-slate-700/60 overflow-x-auto  scrollbar-none',
    tab: 'px-4 sm:px-5 py-2.5 sm:rounded-t-xl',
    // text-slate-100 (not text-white) so light-mode global overrides keep contrast
    active: 'bg-slate-800 text-slate-100 border-b-2 border-accent-400',
    inactive: 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40',
    transition: 'transition-colors',
  },
};

export default function TabBar({
  tabs,
  activeKey,
  onChange,
  className = '',
  listClassName = '',
  tabClassName = '',
  variant = 'contained',
  trailing = null,
  children,
}) {
  const styles = VARIANTS[variant] ?? VARIANTS.contained;
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === activeKey));

  const handleChange = (index) => {
    const tab = tabs[index];
    if (tab) onChange(tab.key);
  };

  const tabClasses = (selected) =>
    [
      `${styles.tab} text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0 focus:outline-none`,
      styles.transition,
      selected ? styles.active : styles.inactive,
      tabClassName,
    ].join(' ');

  const wrapTrailing = Boolean(trailing);
  const listClass = [
    wrapTrailing && variant === 'page'
      ? 'flex gap-1 overflow-x-auto scrollbar-none'
      : styles.list,
    listClassName,
  ].filter(Boolean).join(' ');

  const tabList = (
    <TabList className={listClass}>
      {tabs.map((tab) => (
        <Tab key={tab.key} className={({ selected }) => tabClasses(selected)}>
          {tab.label}
        </Tab>
      ))}
    </TabList>
  );

  const header = wrapTrailing ? (
    <div
      className={[
        'flex items-stretch min-w-0',
        variant === 'page' ? 'border-b border-slate-700/60' : '',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">{tabList}</div>
      <div className="flex-shrink-0 flex items-center pl-2 pr-2 sm:pr-0">
        {trailing}
      </div>
    </div>
  ) : tabList;

  if (children) {
    return (
      <TabGroup selectedIndex={activeIndex} onChange={handleChange}>
        {header}
        <TabPanels className={className}>
          {tabs.map((tab) => (
            <TabPanel key={tab.key} className="focus:outline-none">
              {children(tab.key)}
            </TabPanel>
          ))}
        </TabPanels>
      </TabGroup>
    );
  }

  return (
    <TabGroup selectedIndex={activeIndex} onChange={handleChange} className={className}>
      {header}
    </TabGroup>
  );
}