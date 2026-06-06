import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';

const VARIANTS = {
  contained: {
    list: 'flex flex-wrap gap-1 bg-slate-900 border border-slate-700 rounded-2xl p-1',
    tab: 'px-3 sm:px-4 py-2 rounded-xl',
    active: 'bg-white text-slate-900 shadow-sm',
    inactive: 'text-slate-400 hover:text-white',
    transition: 'transition-all',
  },
  page: {
    list: 'flex gap-1 border-b border-slate-700/60 mb-6  scrollbar-none',
    tab: 'px-4 sm:px-5 py-2.5 rounded-t-xl',
    active: 'bg-slate-800 text-white border-b-2 border-emerald-400 -mb-px',
    inactive: 'text-slate-400 hover:text-white hover:bg-slate-800/40',
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

  if (children) {
    return (
      <TabGroup selectedIndex={activeIndex} onChange={handleChange}>
        <TabList className={[styles.list, listClassName].filter(Boolean).join(' ')}>
          {tabs.map((tab) => (
            <Tab key={tab.key} className={({ selected }) => tabClasses(selected)}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
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
      <TabList className={[styles.list, listClassName].filter(Boolean).join(' ')}>
        {tabs.map((tab) => (
          <Tab key={tab.key} className={({ selected }) => tabClasses(selected)}>
            {tab.label}
          </Tab>
        ))}
      </TabList>
    </TabGroup>
  );
}