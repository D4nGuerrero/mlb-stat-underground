import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';

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
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === activeKey));

  const containedActive = 'bg-white text-slate-900 shadow-sm';
  const containedInactive = 'text-slate-400 hover:text-white';
  const standaloneActive = 'bg-white text-slate-900 shadow-sm';
  const standaloneInactive = 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700';

  const activeStyle = variant === 'standalone' ? standaloneActive : containedActive;
  const inactiveStyle = variant === 'standalone' ? standaloneInactive : containedInactive;

  const handleChange = (index) => {
    const tab = tabs[index];
    if (tab) onChange(tab.key);
  };

  if (children) {
    return (
      <TabGroup selectedIndex={activeIndex} onChange={handleChange}>
        <TabList
          className={[
            variant === 'contained'
              ? 'flex gap-1 bg-slate-900 border border-slate-700 rounded-2xl p-1'
              : 'flex gap-2 overflow-x-auto pb-1',
            listClassName,
          ].join(' ')}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.key}
              className={({ selected }) =>
                [
                  'px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 focus:outline-none',
                  selected ? activeStyle : inactiveStyle,
                  tabClassName,
                ].join(' ')
              }
            >
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
      <TabList
        className={[
          variant === 'contained'
            ? 'flex flex-wrap gap-1 bg-slate-900 border border-slate-700 rounded-2xl p-1 w-fit'
            : 'flex gap-2 overflow-x-auto pb-1',
          listClassName,
        ].join(' ')}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            className={({ selected }) =>
              [
                'px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 focus:outline-none',
                selected ? activeStyle : inactiveStyle,
                tabClassName,
              ].join(' ')
            }
          >
            {tab.label}
          </Tab>
        ))}
      </TabList>
    </TabGroup>
  );
}