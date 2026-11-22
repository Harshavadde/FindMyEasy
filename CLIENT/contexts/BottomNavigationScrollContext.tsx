import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type PropsWithChildren,
  type RefObject,
} from "react";
import { View } from "react-native";

const SCROLL_THRESHOLD = 40;
const DIRECTION_THRESHOLD = 4;

type BottomNavigationScrollContextValue = {
  compact: boolean;
  onScroll: (offsetY: number) => void;
  activeBlurTarget: RefObject<ComponentRef<typeof View> | null> | null;
  activateBlurTarget: (
    target: RefObject<ComponentRef<typeof View> | null>
  ) => void;
  deactivateBlurTarget: (
    target: RefObject<ComponentRef<typeof View> | null>
  ) => void;
};

const BottomNavigationScrollContext =
  createContext<BottomNavigationScrollContextValue | null>(null);

export function BottomNavigationScrollProvider({
  children,
}: PropsWithChildren) {
  const [compact, setCompact] = useState(false);
  const [activeBlurTarget, setActiveBlurTarget] =
    useState<RefObject<ComponentRef<typeof View> | null> | null>(null);
  const compactRef = useRef(false);
  const lastOffsetY = useRef(0);

  const updateCompact = useCallback((nextCompact: boolean) => {
    if (compactRef.current === nextCompact) return;

    compactRef.current = nextCompact;
    setCompact(nextCompact);
  }, []);

  const activateBlurTarget = useCallback(
    (target: RefObject<ComponentRef<typeof View> | null>) => {
      setActiveBlurTarget((current) => (current === target ? current : target));
    },
    []
  );

  const deactivateBlurTarget = useCallback(
    (target: RefObject<ComponentRef<typeof View> | null>) => {
      setActiveBlurTarget((current) => (current === target ? null : current));
    },
    []
  );

  const onScroll = useCallback(
    (offsetY: number) => {
      const previousOffsetY = lastOffsetY.current;
      lastOffsetY.current = offsetY;

      if (offsetY <= SCROLL_THRESHOLD) {
        updateCompact(false);
        return;
      }

      const delta = offsetY - previousOffsetY;
      if (delta > DIRECTION_THRESHOLD) {
        updateCompact(true);
      } else if (delta < -DIRECTION_THRESHOLD) {
        updateCompact(false);
      }
    },
    [updateCompact]
  );

  const value = useMemo(
    () => ({
      compact,
      onScroll,
      activeBlurTarget,
      activateBlurTarget,
      deactivateBlurTarget,
    }),
    [activeBlurTarget, activateBlurTarget, compact, deactivateBlurTarget, onScroll]
  );

  return (
    <BottomNavigationScrollContext.Provider value={value}>
      {children}
    </BottomNavigationScrollContext.Provider>
  );
}

export function useBottomNavigationScroll() {
  const context = useContext(BottomNavigationScrollContext);
  if (!context) {
    throw new Error(
      "useBottomNavigationScroll must be used within BottomNavigationScrollProvider."
    );
  }
  return context;
}
