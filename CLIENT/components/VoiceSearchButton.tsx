import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { requireOptionalNativeModule } from "expo";
import type {
  ExpoSpeechRecognitionNativeEventMap,
  ExpoSpeechRecognitionOptions,
} from "expo-speech-recognition";

type Props = {
  onTranscriptChange: (transcript: string) => void;
};

type SpeechRecognitionModule = {
  addListener<EventName extends keyof ExpoSpeechRecognitionNativeEventMap>(
    eventName: EventName,
    listener: (event: ExpoSpeechRecognitionNativeEventMap[EventName]) => void
  ): { remove: () => void };
  isRecognitionAvailable(): boolean;
  requestPermissionsAsync(): Promise<{
    granted: boolean;
    canAskAgain?: boolean;
  }>;
  start(options: ExpoSpeechRecognitionOptions): void;
  stop(): void;
  abort(): void;
};

const speechRecognition =
  requireOptionalNativeModule<SpeechRecognitionModule>(
    "ExpoSpeechRecognition"
  );

function getFriendlyError(error: string) {
  switch (error) {
    case "not-allowed":
      return "Microphone or speech recognition access is off. Allow access in Settings and try again.";
    case "language-not-supported":
      return "English (India) is not available on this device. Try English (US), or check Dictation languages in Settings.";
    case "network":
      return "Speech recognition could not connect. Check your internet connection and try again.";
    case "no-speech":
    case "speech-timeout":
      return "We didn't hear any speech. Move closer to your microphone and try again.";
    case "audio-capture":
      return "The microphone is unavailable. Check that it is not being used by another app.";
    case "service-not-allowed":
      return "Speech recognition is unavailable. Check Siri & Dictation in Settings and try again.";
    case "busy":
    case "too-many-requests":
      return "Speech recognition is busy. Please wait a moment and try again.";
    default:
      return "We couldn't recognize that. Please try again.";
  }
}

export default function VoiceSearchButton({ onTranscriptChange }: Props) {
  const [dialogVisible, setDialogVisible] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const [hasFinalResult, setHasFinalResult] = useState(false);
  const isActive = useRef(false);
  const isStarting = useRef(false);
  const hasFinalResultRef = useRef(false);
  const attemptId = useRef(0);
  const language = useRef("en-IN");
  const transcriptCallback = useRef(onTranscriptChange);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    transcriptCallback.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    if (!recognizing) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.35,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [pulse, recognizing]);

  useEffect(() => {
    if (!speechRecognition) return;

    const subscriptions = [
      speechRecognition.addListener("start", () => {
        if (!isActive.current) return;
        setPreparing(false);
        setStopping(false);
        setRecognizing(true);
      }),
      speechRecognition.addListener("end", () => {
        if (!isActive.current) return;
        isActive.current = false;
        setRecognizing(false);
        setPreparing(false);
        setStopping(false);
        if (!hasFinalResultRef.current) {
          setErrorMessage(getFriendlyError("no-speech"));
        }
      }),
      speechRecognition.addListener("result", (event) => {
        if (!isActive.current) return;
        const recognizedText = event.results[0]?.transcript.trim();
        if (!recognizedText) return;

        setTranscript(recognizedText);
        if (event.isFinal) {
          hasFinalResultRef.current = true;
          setHasFinalResult(true);
          transcriptCallback.current(recognizedText);
        }
      }),
      speechRecognition.addListener("error", (event) => {
        if (!isActive.current) return;
        isActive.current = false;
        isStarting.current = false;
        setRecognizing(false);
        setPreparing(false);
        setStopping(false);

        if (event.error === "aborted") return;
        if (event.error === "language-not-supported") {
          language.current = "en-US";
        }
        setCanOpenSettings(event.error === "not-allowed");
        setErrorMessage(getFriendlyError(event.error));
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      if (isActive.current) speechRecognition.abort();
      isActive.current = false;
    };
  }, []);

  const startRecognition = async () => {
    if (!speechRecognition) {
      Alert.alert(
        "Voice search needs an app update",
        "Install the latest FindMyEasy development build to use voice search. Expo Go and older app builds do not include the speech-recognition module."
      );
      return;
    }
    if (isStarting.current || isActive.current) return;

    const currentAttempt = ++attemptId.current;
    isStarting.current = true;
    setDialogVisible(true);
    setPreparing(true);
    setStopping(false);
    setTranscript("");
    setErrorMessage(null);
    setCanOpenSettings(false);
    setHasFinalResult(false);
    hasFinalResultRef.current = false;
    Keyboard.dismiss();

    try {
      const permission = await speechRecognition.requestPermissionsAsync();
      if (currentAttempt !== attemptId.current) return;
      if (!permission.granted) {
        setCanOpenSettings(permission.canAskAgain === false);
        setErrorMessage(
          "Allow microphone and speech recognition access to search by voice."
        );
        return;
      }

      if (!speechRecognition.isRecognitionAvailable()) {
        setErrorMessage(
          "Speech recognition isn't available on this device. Check Siri & Dictation and try again."
        );
        return;
      }

      isActive.current = true;
      speechRecognition.start({
        lang: language.current,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        contextualStrings: [
          "FindMyEasy",
          "PG",
          "hostel",
          "co-living",
          "metro",
          "IT park",
          "coaching hub",
        ],
      });
    } catch (error) {
      if (currentAttempt !== attemptId.current) return;
      isActive.current = false;
      setRecognizing(false);
      console.error("Unable to start voice search:", error);
      setErrorMessage(
        "Could not start speech recognition. Check your permissions and try again."
      );
    } finally {
      if (currentAttempt === attemptId.current) {
        isStarting.current = false;
        setPreparing(false);
      }
    }
  };

  const cancelRecognition = () => {
    attemptId.current += 1;
    isStarting.current = false;
    if (isActive.current) speechRecognition?.abort();
    isActive.current = false;
    setRecognizing(false);
    setPreparing(false);
    setStopping(false);
    setDialogVisible(false);
  };

  const stopRecognition = () => {
    if (!speechRecognition || !isActive.current || stopping) return;
    setStopping(true);
    speechRecognition.stop();
  };

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error("Unable to open app settings:", error);
      setErrorMessage(
        "Open FindMyEasy in your device Settings and allow microphone and speech recognition access."
      );
    }
  };

  const toggleRecognition = () => {
    if (isActive.current) {
      stopRecognition();
      return;
    }
    void startRecognition();
  };

  const showRecognizingState = recognizing || stopping;

  return (
    <>
      <Pressable
        onPress={toggleRecognition}
        accessibilityRole="button"
        accessibilityLabel={
          showRecognizingState ? "Stop voice search" : "Search by voice"
        }
        accessibilityState={{ selected: showRecognizingState }}
        hitSlop={8}
        className={`ml-1 h-9 w-9 items-center justify-center rounded-full ${
          showRecognizingState ? "bg-[#FEE2E2]" : "bg-[#EFF6FF]"
        }`}
      >
        <MaterialCommunityIcons
          name={showRecognizingState ? "microphone-off" : "microphone"}
          size={19}
          color={showRecognizingState ? "#DC2626" : "#2563EB"}
        />
      </Pressable>

      <Modal
        visible={dialogVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelRecognition}
        statusBarTranslucent
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full max-w-[360px] rounded-[24px] bg-white p-6">
            <View className="mb-4 h-[76px] items-center justify-center">
              {showRecognizingState ? (
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: 62,
                    height: 62,
                    borderRadius: 31,
                    backgroundColor: "#FECACA",
                    opacity: pulse.interpolate({
                      inputRange: [1, 1.35],
                      outputRange: [0.55, 0.1],
                    }),
                    transform: [{ scale: pulse }],
                  }}
                />
              ) : null}
              <View
                className={`h-14 w-14 items-center justify-center rounded-full ${
                  showRecognizingState ? "bg-[#FEE2E2]" : "bg-[#EFF6FF]"
                }`}
              >
                <MaterialCommunityIcons
                  name={showRecognizingState ? "microphone" : "microphone-outline"}
                  size={27}
                  color={showRecognizingState ? "#DC2626" : "#2563EB"}
                />
              </View>
            </View>

            <Text className="text-center text-[19px] font-extrabold text-[#0F172A]">
              {errorMessage
                ? "Voice search unavailable"
                : hasFinalResult
                  ? "Search text ready"
                  : stopping
                    ? "Finishing up..."
                    : recognizing
                      ? "Listening..."
                      : preparing
                        ? "Getting ready..."
                        : "Voice search"}
            </Text>
            <Text className="mt-2 text-center text-[13px] leading-5 text-[#64748B]">
              {errorMessage ??
                (recognizing
                  ? "Say a property, area, city, or nearby place."
                  : "Speak clearly to search FindMyEasy.")}
            </Text>

            {transcript ? (
              <View className="mt-4 rounded-[14px] bg-[#F8FAFC] p-3">
                <Text className="text-[11px] font-bold uppercase text-[#64748B]">
                  {hasFinalResult ? "Recognized text" : "Hearing"}
                </Text>
                <Text className="mt-1 text-[15px] font-semibold text-[#0F172A]">
                  “{transcript}”
                </Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row gap-3">
              {errorMessage ? (
                <>
                  {canOpenSettings ? (
                    <Pressable
                      onPress={() => void openSettings()}
                      className="flex-1 items-center rounded-[12px] bg-[#EFF6FF] px-4 py-3"
                    >
                      <Text className="text-[13px] font-bold text-[#1D4ED8]">
                        Open Settings
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => void startRecognition()}
                    className="flex-1 items-center rounded-[12px] bg-[#2563EB] px-4 py-3"
                  >
                    <Text className="text-[13px] font-bold text-white">
                      Try again
                    </Text>
                  </Pressable>
                </>
              ) : hasFinalResult ? (
                <>
                  <Pressable
                    onPress={() => void startRecognition()}
                    className="flex-1 items-center rounded-[12px] bg-[#EFF6FF] px-4 py-3"
                  >
                    <Text className="text-[13px] font-bold text-[#1D4ED8]">
                      Retry
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={cancelRecognition}
                    className="flex-1 items-center rounded-[12px] bg-[#2563EB] px-4 py-3"
                  >
                    <Text className="text-[13px] font-bold text-white">
                      Use this search
                    </Text>
                  </Pressable>
                </>
              ) : recognizing ? (
                <Pressable
                  onPress={stopRecognition}
                  disabled={stopping}
                  className="flex-1 items-center rounded-[12px] bg-[#2563EB] px-4 py-3"
                >
                  <Text className="text-[13px] font-bold text-white">
                    {stopping ? "Finishing..." : "Stop listening"}
                  </Text>
                </Pressable>
              ) : null}

              {!hasFinalResult ? (
                <Pressable
                  onPress={cancelRecognition}
                  className="flex-1 items-center rounded-[12px] bg-[#F1F5F9] px-4 py-3"
                >
                  <Text className="text-[13px] font-bold text-[#475569]">
                    Cancel
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
