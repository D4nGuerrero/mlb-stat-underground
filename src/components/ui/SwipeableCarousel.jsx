import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { RadioGroup, Radio } from '@headlessui/react';

const SwipeableCarousel = forwardRef(function SwipeableCarousel(
  {
    children,
    startIndex = 0,
    selectedIndex = 0,
    onSelectedIndexChange,
    showArrows = false,
    showDots = false,
    hideUntilReady = false,
    slideGap = 16,
    className = '',
    slideClassName = '',
    arrowsClassName = '',
    dotsClassName = '',
  },
  ref,
) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    dragFree: false,
    align: 'start',
    containScroll: 'trimSnaps',
    skipSnaps: false,
    startIndex,
  });

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [ready, setReady] = useState(!hideUntilReady);
  const skipNextSelect = useRef(true);
  const prevIndexRef = useRef(selectedIndex);

  const slides = Array.isArray(children) ? children : [children];
  const slideCount = slides.length;

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index, jump = false) => emblaApi?.scrollTo(index, jump), [emblaApi]);

  useImperativeHandle(
    ref,
    () => ({ scrollPrev, scrollNext, scrollTo, emblaApi }),
    [scrollPrev, scrollNext, scrollTo, emblaApi],
  );

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    const onInit = () => {
      emblaApi.scrollTo(startIndex, true);
      setReady(true);
      skipNextSelect.current = true;
      updateButtons();
    };

    if (emblaApi.scrollSnapList().length > 0) {
      onInit();
    } else {
      emblaApi.on('init', onInit);
      return () => emblaApi.off('init', onInit);
    }
    return undefined;
  }, [emblaApi, startIndex, updateButtons]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      if (skipNextSelect.current) {
        skipNextSelect.current = false;
        updateButtons();
        return;
      }
      onSelectedIndexChange?.(emblaApi.selectedScrollSnap());
      updateButtons();
    };

    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('scroll', updateButtons);
    updateButtons();

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
      emblaApi.off('scroll', updateButtons);
    };
  }, [emblaApi, onSelectedIndexChange, updateButtons]);

  useEffect(() => {
    if (!emblaApi || !ready) return;
    if (emblaApi.selectedScrollSnap() === selectedIndex) return;
    const jump = Math.abs(selectedIndex - prevIndexRef.current) > 1;
    emblaApi.scrollTo(selectedIndex, jump);
    prevIndexRef.current = selectedIndex;
  }, [emblaApi, selectedIndex, ready]);

  return (
    <div className={className}>
      <div
        className={`overflow-hidden touch-pan-y transition-opacity duration-150 ${
          hideUntilReady && !ready ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ '--slide-spacing': `${slideGap}px` }}
        ref={emblaRef}
      >
        <div className="flex ml-[calc(var(--slide-spacing)*-1)]">
          {slides.map((slide, i) => (
            <div
              key={slide?.key ?? i}
              className={`flex-[0_0_100%] min-w-0 pl-[var(--slide-spacing)] ${slideClassName}`}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {showArrows && slideCount > 1 && (
        <div className={`flex items-center justify-center gap-3 mt-4 ${arrowsClassName}`}>
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canPrev}
            aria-label="Previous slide"
            className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            disabled={!canNext}
            aria-label="Next slide"
            className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      )}

      {showDots && slideCount > 1 && (
        <RadioGroup
          value={selectedIndex}
          onChange={(index) => scrollTo(index, true)}
          className={`flex items-center justify-center gap-2 mt-4 flex-wrap ${dotsClassName}`}
          aria-label="Slide navigation"
        >
          {slides.map((slide, i) => (
            <Radio
              key={slide?.key ?? i}
              value={i}
              className={({ checked }) =>
                [
                  'w-2 h-2 rounded-full transition-all',
                  checked ? 'bg-emerald-400 scale-125' : 'bg-slate-600 hover:bg-slate-500',
                ].join(' ')
              }
            />
          ))}
        </RadioGroup>
      )}
    </div>
  );
});

export default SwipeableCarousel;