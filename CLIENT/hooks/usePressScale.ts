import { useCallback, useRef } from "react";
import { Animated } from "react-native";

export function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 28,
      bounciness: 3,
    }).start();
  }, [scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 3,
    }).start();
  }, [scale]);

  return { scale, onPressIn, onPressOut };
}
