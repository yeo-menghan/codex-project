import { useCallback, useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { papers as seedPapers } from "../data/papers";
import type { Paper } from "../types/paper";
import PaperSlide from "./PaperSlide";
import UploadPanel from "./UploadPanel";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

function paperIndexFromURL(papers: Paper[]): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const params = new URLSearchParams(window.location.search);
  const paperId = params.get("paper");
  if (!paperId) {
    return 0;
  }

  const index = papers.findIndex((paper) => paper.id === paperId);
  return index >= 0 ? index : 0;
}

function syncURLWithPaper(paperId: string) {
  if (typeof window === "undefined") {
    return;
  }
  const nextURL = `${window.location.pathname}?paper=${paperId}`;
  window.history.replaceState({}, "", nextURL);
}

export default function PaperCarousel() {
  const [carouselPapers, setCarouselPapers] = useState<Paper[]>(seedPapers);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingFocusPaperId, setPendingFocusPaperId] = useState<string | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPapers = async () => {
      try {
        const response = await fetch(`${API_BASE}/papers`);
        if (!response.ok) {
          return;
        }

        const backendPapers = (await response.json()) as Paper[];
        if (!Array.isArray(backendPapers) || backendPapers.length === 0 || cancelled) {
          return;
        }

        setCarouselPapers(backendPapers);
      } catch {
        // Keep local seed papers when backend listing is unavailable.
      }
    };

    void loadPapers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (carouselPapers.length === 0) {
      return;
    }

    const nextIndex = paperIndexFromURL(carouselPapers);
    setActiveIndex(nextIndex);
    swiperRef.current?.slideTo(nextIndex, 0);
  }, [carouselPapers]);

  useEffect(() => {
    if (!pendingFocusPaperId) {
      return;
    }

    const nextIndex = carouselPapers.findIndex((paper) => paper.id === pendingFocusPaperId);
    if (nextIndex < 0) {
      return;
    }

    setActiveIndex(nextIndex);
    swiperRef.current?.slideTo(nextIndex, 350);
    syncURLWithPaper(pendingFocusPaperId);
    setPendingFocusPaperId(null);
  }, [carouselPapers, pendingFocusPaperId]);

  const handlePaperCreated = useCallback((paper: Paper) => {
    setCarouselPapers((prev) => {
      const index = prev.findIndex((item) => item.id === paper.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = paper;
        return next;
      }
      return [...prev, paper];
    });
    setPendingFocusPaperId(paper.id);
  }, []);

  return (
    <main className="carouselPage">
      <UploadPanel onPaperCreated={handlePaperCreated} />

      <Swiper
        className="paperSwiper"
        modules={[Mousewheel]}
        direction="vertical"
        slidesPerView={1}
        spaceBetween={0}
        mousewheel={{
          forceToAxis: true,
          thresholdDelta: 55,
          thresholdTime: 400,
          releaseOnEdges: true
        }}
        longSwipes={false}
        shortSwipes
        preventInteractionOnTransition
        speed={500}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          const nextIndex = paperIndexFromURL(carouselPapers);
          swiper.slideTo(nextIndex, 0);
        }}
        onSlideChange={(swiper) => {
          const nextIndex = swiper.activeIndex;
          setActiveIndex(nextIndex);

          const paperId = carouselPapers[nextIndex]?.id;
          if (paperId) {
            syncURLWithPaper(paperId);
          }
        }}
      >
        {carouselPapers.map((paper, index) => (
          <SwiperSlide key={paper.id}>
            <PaperSlide paper={paper} isActive={index === activeIndex} />
          </SwiperSlide>
        ))}
      </Swiper>
    </main>
  );
}
