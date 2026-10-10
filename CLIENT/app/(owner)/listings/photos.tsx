import { useState } from "react";
import { API_BASE_URL } from "../../../constants/api";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
 
  ScrollView,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";


/* =========================================================
   TYPES
========================================================= */

type ImageType =
  | "COVER"
  | "PROPERTY"
  | "ROOM"
  | "BED"
  | "WASHROOM"
  | "MESS";

type ListingImage = {
  id: string;
  uri: string;
  type: ImageType;
  uploaded: boolean;
  uploading: boolean;
  serverId?: string;
  serverUrl?: string;
};

type UploadResponse = {
  id: string;
  listing_id: string;
  image_url: string;
  image_type: ImageType;
  original_filename?: string | null;
};

/* =========================================================
   CONFIG
========================================================= */



/* =========================================================
   IMAGE SECTIONS
========================================================= */

const IMAGE_SECTIONS: {
  type: ImageType;
  title: string;
  description: string;
  maxImages: number;
}[] = [
  {
    type: "PROPERTY",
    title: "Property Photos",
    description: "Building, entrance, lobby and common areas",
    maxImages: 5,
  },
  {
    type: "ROOM",
    title: "Room Photos",
    description: "Show rooms and their interiors",
    maxImages: 5,
  },
  {
    type: "BED",
    title: "Bed Photos",
    description: "Show available beds and sleeping areas",
    maxImages: 5,
  },
  {
    type: "WASHROOM",
    title: "Washroom Photos",
    description: "Show attached or common washrooms",
    maxImages: 3,
  },
  {
    type: "MESS",
    title: "Mess / Food Photos",
    description: "Show dining area and food facilities",
    maxImages: 3,
  },
];

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function ListingPhotos() {
  const params = useLocalSearchParams<{
    listingId?: string;
  }>();

  const listingId = params.listingId;

  const [images, setImages] = useState<ListingImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  /* =======================================================
     IMAGE HELPERS
  ======================================================= */

  const coverImage = images.find(
    (image) => image.type === "COVER"
  );

  const getImagesByType = (type: ImageType) => {
    return images.filter((image) => image.type === type);
  };

  const getMaxImages = (type: ImageType) => {
    if (type === "COVER") {
      return 1;
    }

    return (
      IMAGE_SECTIONS.find(
        (section) => section.type === type
      )?.maxImages ?? 5
    );
  };

  /* =======================================================
     IMAGE SOURCE SELECTION
  ======================================================= */

  const showImageSource = (type: ImageType) => {
    Alert.alert(
      "Add Photo",
      "Choose how you want to add the photo.",
      [
        {
          text: "Gallery",
          onPress: () => {
            void pickFromGallery(type);
          },
        },
        {
          text: "Camera",
          onPress: () => {
            void takePhoto(type);
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  /* =======================================================
     GALLERY
  ======================================================= */

  const pickFromGallery = async (type: ImageType) => {
    try {
      const currentCount =
        getImagesByType(type).length;

      const maxImages = getMaxImages(type);

      const remaining =
        maxImages - currentCount;

      if (remaining <= 0) {
        Alert.alert(
          "Maximum photos reached",
          `You can add up to ${maxImages} photos here.`
        );
        return;
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Gallery permission required",
          "Please allow photo access to select property images."
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          allowsMultipleSelection: type !== "COVER",
          selectionLimit: remaining,
          quality: 1,
        });

      if (result.canceled) {
        return;
      }

      const selectedUris = result.assets
        .map((asset) => asset.uri)
        .filter(Boolean);

      await processSelectedImages(
        selectedUris,
        type
      );
    } catch (error) {
      console.error(
        "Gallery selection error:",
        error
      );

      Alert.alert(
        "Gallery error",
        "Unable to select the photos."
      );
    }
  };

  /* =======================================================
     CAMERA
  ======================================================= */

  const takePhoto = async (type: ImageType) => {
    try {
      const currentCount =
        getImagesByType(type).length;

      const maxImages = getMaxImages(type);

      if (currentCount >= maxImages) {
        Alert.alert(
          "Maximum photos reached",
          `You can add up to ${maxImages} photos here.`
        );
        return;
      }

      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera permission required",
          "Please allow camera access to take property photos."
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 1,
        });

      if (result.canceled) {
        return;
      }

      const selectedUris = result.assets
        .map((asset) => asset.uri)
        .filter(Boolean);

      await processSelectedImages(
        selectedUris,
        type
      );
    } catch (error) {
      console.error(
        "Camera error:",
        error
      );

      Alert.alert(
        "Camera error",
        "Unable to capture the photo."
      );
    }
  };

  /* =======================================================
     PROCESS SELECTED IMAGES
  ======================================================= */

  const processSelectedImages = async (
    uris: string[],
    type: ImageType
  ) => {
    if (!listingId) {
      Alert.alert(
        "Listing ID missing",
        "This property has not been created correctly. Please go back and save the property again."
      );
      return;
    }

    const currentCount =
      getImagesByType(type).length;

    const maxImages = getMaxImages(type);

    const availableSlots =
      maxImages - currentCount;

    const selectedUris =
      uris.slice(0, availableSlots);

    if (selectedUris.length === 0) {
      return;
    }

    setIsUploading(true);

    try {
      /*
       * Upload one image at a time.
       *
       * This keeps the upload stable and makes sure
       * one failed image does not corrupt the others.
       */

      for (const uri of selectedUris) {
        let compressedUri = uri;

        /* -----------------------------------------------
           COMPRESS IMAGE
        ------------------------------------------------ */

        try {
          const compressed =
            await ImageManipulator.manipulateAsync(
              uri,
              [],
              {
                compress: 0.75,
                format:
                  ImageManipulator.SaveFormat.JPEG,
              }
            );

          compressedUri = compressed.uri;
        } catch (compressionError) {
          console.warn(
            "Image compression failed. Using original image.",
            compressionError
          );
        }

        /* -----------------------------------------------
           LOCAL IMAGE ID
        ------------------------------------------------ */

        const localId =
          `${type}-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 10)}`;

        const newImage: ListingImage = {
          id: localId,
          uri: compressedUri,
          type,
          uploading: true,
          uploaded: false,
        };

        /* -----------------------------------------------
           SHOW IMAGE IMMEDIATELY
        ------------------------------------------------ */

        setImages((previous) => [
          ...previous,
          newImage,
        ]);

        /* -----------------------------------------------
           UPLOAD TO SERVER
        ------------------------------------------------ */

        try {
          const uploadedImage =
            await uploadImage(
              compressedUri,
              type
            );

          /* ---------------------------------------------
             UPDATE UI WITH DATABASE IMAGE
          ---------------------------------------------- */

          setImages((previous) =>
            previous.map((image) =>
              image.id === localId
                ? {
                    ...image,
                    uploading: false,
                    uploaded: true,
                    serverId:
                      uploadedImage.id,
                    serverUrl:
                      uploadedImage.image_url,
                  }
                : image
            )
          );

          console.log(
            "Image uploaded successfully:",
            uploadedImage
          );
        } catch (uploadError) {
          console.error(
            "Image upload failed:",
            uploadError
          );

          /*
           * Remove only this failed image.
           * Other uploaded images remain.
           */

          setImages((previous) =>
            previous.filter(
              (image) =>
                image.id !== localId
            )
          );
        }
      }
    } catch (error) {
      console.error(
        "Image processing error:",
        error
      );

      Alert.alert(
        "Upload failed",
        error instanceof Error
          ? error.message
          : "Unable to upload the selected image."
      );
    } finally {
      setIsUploading(false);
    }
  };

  /* =======================================================
     UPLOAD IMAGE
     
     IMPORTANT:
     We intentionally use XMLHttpRequest instead of
     fetch/expo-fetch here.

     This avoids the Expo FormDataPart problem.
  ======================================================= */

const uploadImage = async (
  uri: string,
  type: ImageType
): Promise<UploadResponse> => {
  if (!listingId) {
    throw new Error("Listing ID is missing.");
  }

  const uploadUrl =
    `${API_BASE_URL}/api/v1/owner/listings/${listingId}/images/raw` +
    `?image_type=${encodeURIComponent(type)}`;

  console.log("========================================");
  console.log("RAW IMAGE UPLOAD STARTED");
  console.log("Image URI:", uri);
  console.log("Upload URL:", uploadUrl);

  try {
    // Create a real Expo File from the selected/compressed image.
    const file = new File(uri);

    console.log("File URI:", file.uri);

    // Send the actual image bytes.
    // NO FormData.
    // NO multipart/form-data.
    // NO uploadAsync().
    // NO FormDataPart.
    const response = await expoFetch(uploadUrl, {
      method: "POST",

      headers: {
        "Content-Type": "image/jpeg",
        "X-File-Name": `photo-${Date.now()}.jpg`,
        Accept: "application/json",
      },

      body: file,
    });

    console.log(
      "Upload HTTP status:",
      response.status
    );

    const responseText = await response.text();

    console.log(
      "Upload response:",
      responseText
    );

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      throw new Error(
        `Image upload failed (${response.status}): ${responseText}`
      );
    }

    let result: UploadResponse;

    try {
      result = JSON.parse(
        responseText
      ) as UploadResponse;
    } catch {
      throw new Error(
        "Server returned invalid JSON."
      );
    }

    if (!result.id) {
      throw new Error(
        "Server did not return an image ID."
      );
    }

    if (!result.image_url) {
      throw new Error(
        "Server did not return an image URL."
      );
    }

    console.log(
      "IMAGE UPLOAD SUCCESS"
    );

    console.log(
      "Image ID:",
      result.id
    );

    console.log(
      "Image URL:",
      result.image_url
    );

    console.log("========================================");

    return result;

  } catch (error) {
    console.error(
      "========================================"
    );

    console.error(
      "RAW IMAGE UPLOAD FAILED"
    );

    console.error(error);

    console.error(
      "========================================"
    );

    throw error;
  }
};

  /* =======================================================
     REMOVE IMAGE
  ======================================================= */

  const handleRemoveImage = (
    id: string
  ) => {
    const image =
      images.find(
        (item) => item.id === id
      );

    if (!image) {
      return;
    }

    if (image.uploading) {
      return;
    }

    /*
     * For now remove from local UI.
     *
     * Server DELETE endpoint can be added later.
     */

    setImages((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    );
  };

  /* =======================================================
     CONTINUE
  ======================================================= */

  const handleContinue = () => {
    if (!listingId) {
      Alert.alert(
        "Listing ID missing",
        "Please go back and create the property again."
      );
      return;
    }

    if (!coverImage) {
      Alert.alert(
        "Cover photo required",
        "Please add a cover photo before continuing."
      );
      return;
    }

    if (!coverImage.uploaded) {
      Alert.alert(
        "Cover photo still uploading",
        "Please wait until the cover photo has finished uploading."
      );
      return;
    }

    const stillUploading =
      images.some(
        (image) =>
          image.uploading
      );

    if (stillUploading) {
      Alert.alert(
        "Please wait",
        "Some photos are still uploading."
      );
      return;
    }

    const failedImages =
      images.filter(
        (image) =>
          !image.uploaded
      );

    if (
      failedImages.length > 0
    ) {
      Alert.alert(
        "Photo upload incomplete",
        "Please make sure all selected photos have been uploaded successfully."
      );
      return;
    }

    router.replace("/(owner)");
  };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <SafeAreaView className="flex-1 bg-[#F5F9FD]">
      <View className="flex-1">

        {/* HEADER */}

        <View className="border-b border-[#E8EEF5] bg-[#F5F9FD] px-5 pb-4 pt-4">
          <View className="flex-row items-center">

            <Pressable
              disabled={isUploading}
              onPress={() =>
                router.back()
              }
              className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-white"
            >
              <Text className="text-[24px] text-[#0F172A]">
                ‹
              </Text>
            </Pressable>

            <View className="flex-1">
              <Text className="text-[25px] font-extrabold text-[#0F172A]">
                Add Photos
              </Text>

              <Text className="mt-1 text-[12px] text-[#64748B]">
                Add real photos from your gallery or camera
              </Text>
            </View>

          </View>
        </View>

        {/* CONTENT */}

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 130,
          }}
        >

          {/* PROGRESS */}

          <View className="mb-5 rounded-[18px] bg-white p-4">
            <View className="flex-row items-center justify-between">

              <Text className="text-[13px] font-bold text-[#475569]">
                Listing progress
              </Text>

              <Text className="text-[13px] font-extrabold text-[#2563EB]">
                Step 2 of 3
              </Text>

            </View>

            <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5EAF0]">
              <View
                className="h-full rounded-full bg-[#2563EB]"
                style={{
                  width: "66%",
                }}
              />
            </View>
          </View>

          {/* COVER PHOTO */}

          <View className="mb-5 rounded-[24px] bg-white p-5">

            <View className="flex-row items-start justify-between">

              <View className="flex-1 pr-3">

                <View className="flex-row items-center">

                  <Text className="text-[18px] font-extrabold text-[#0F172A]">
                    Cover Photo
                  </Text>

                  <View className="ml-2 rounded-full bg-[#EAF2FF] px-2.5 py-1">
                    <Text className="text-[10px] font-extrabold text-[#2563EB]">
                      REQUIRED
                    </Text>
                  </View>

                </View>

                <Text className="mt-1 text-[12px] leading-5 text-[#64748B]">
                  Choose the best photo of your property.
                </Text>

              </View>

            </View>

            {coverImage ? (
              <View className="mt-4 overflow-hidden rounded-[18px]">

                <Image
                  source={{
                    uri: coverImage.uri,
                  }}
                  className="h-[190px] w-full"
                  resizeMode="cover"
                />

                <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between">

                  <View className="rounded-full bg-black/60 px-3 py-2">
                    <Text className="text-[11px] font-bold text-white">
                      {coverImage.uploading
                        ? "Uploading..."
                        : coverImage.uploaded
                        ? "✓ Uploaded"
                        : "Cover photo"}
                    </Text>
                  </View>

                  <Pressable
                    disabled={
                      coverImage.uploading
                    }
                    onPress={() =>
                      handleRemoveImage(
                        coverImage.id
                      )
                    }
                    className="h-9 w-9 items-center justify-center rounded-full bg-black/60"
                  >
                    <Text className="text-[18px] font-bold text-white">
                      ×
                    </Text>
                  </Pressable>

                </View>

              </View>
            ) : (
              <Pressable
                disabled={isUploading}
                onPress={() =>
                  showImageSource(
                    "COVER"
                  )
                }
                className="mt-4 h-[190px] items-center justify-center rounded-[18px] border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC]"
              >

                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF]">
                  <Text className="text-[27px] text-[#2563EB]">
                    +
                  </Text>
                </View>

                <Text className="mt-3 text-[14px] font-extrabold text-[#0F172A]">
                  Add Cover Photo
                </Text>

                <Text className="mt-1 text-[11px] text-[#64748B]">
                  Gallery or Camera
                </Text>

              </Pressable>
            )}

          </View>

          {/* OTHER IMAGE SECTIONS */}

          {IMAGE_SECTIONS.map(
            (section) => (
              <PhotoSection
                key={section.type}
                title={section.title}
                description={
                  section.description
                }
                type={section.type}
                images={getImagesByType(
                  section.type
                )}
                maxImages={
                  section.maxImages
                }
                onAdd={
                  showImageSource
                }
                onRemove={
                  handleRemoveImage
                }
              />
            )
          )}

        </ScrollView>

        {/* BOTTOM BAR */}

        <View
          className="absolute bottom-0 left-0 right-0 bg-white px-5 pb-6 pt-4"
          style={{
            borderTopWidth: 1,
            borderTopColor:
              "#E5EAF0",
          }}
        >

          <View className="mb-3 flex-row items-center justify-between">

            <Text className="text-[12px] text-[#64748B]">
              {images.length} photo
              {images.length === 1
                ? ""
                : "s"}{" "}
              added
            </Text>

            {isUploading && (
              <View className="flex-row items-center">

                <ActivityIndicator
                  size="small"
                  color="#2563EB"
                />

                <Text className="ml-2 text-[11px] font-bold text-[#2563EB]">
                  Uploading...
                </Text>

              </View>
            )}

          </View>

          <Pressable
            disabled={
              isUploading ||
              !coverImage ||
              !coverImage.uploaded
            }
            onPress={
              handleContinue
            }
            className={`h-[54px] items-center justify-center rounded-[17px] ${
              isUploading ||
              !coverImage ||
              !coverImage.uploaded
                ? "bg-[#94A3B8]"
                : "bg-[#2563EB]"
            }`}
          >
            <Text className="text-[15px] font-extrabold text-white">
              Continue to Review
            </Text>
          </Pressable>

        </View>

      </View>
    </SafeAreaView>
  );
}

/* =========================================================
   PHOTO SECTION COMPONENT
========================================================= */

function PhotoSection({
  title,
  description,
  type,
  images,
  maxImages,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  type: ImageType;
  images: ListingImage[];
  maxImages: number;
  onAdd: (
    type: ImageType
  ) => void;
  onRemove: (
    id: string
  ) => void;
}) {
  return (
    <View className="mb-5 rounded-[24px] bg-white p-5">

      {/* HEADER */}

      <View className="flex-row items-start justify-between">

        <View className="flex-1 pr-3">

          <Text className="text-[18px] font-extrabold text-[#0F172A]">
            {title}
          </Text>

          <Text className="mt-1 text-[12px] leading-5 text-[#64748B]">
            {description}
          </Text>

        </View>

        <View className="rounded-full bg-[#F1F5F9] px-2.5 py-1.5">
          <Text className="text-[10px] font-extrabold text-[#64748B]">
            {images.length}/{maxImages}
          </Text>
        </View>

      </View>

      {/* IMAGE GRID */}

      {images.length > 0 && (
        <View className="mt-4 flex-row flex-wrap">

          {images.map(
            (image) => (
              <View
                key={image.id}
                className="mb-3 mr-3 overflow-hidden rounded-[14px]"
                style={{
                  width: "30%",
                  aspectRatio: 1,
                }}
              >

                <Image
                  source={{
                    uri: image.uri,
                  }}
                  className="h-full w-full"
                  resizeMode="cover"
                />

                {/* UPLOADING */}

                {image.uploading && (
                  <View className="absolute inset-0 items-center justify-center bg-black/40">

                    <ActivityIndicator
                      color="#FFFFFF"
                    />

                    <Text className="mt-1 text-[9px] font-bold text-white">
                      Uploading
                    </Text>

                  </View>
                )}

                {/* SAVED */}

                {image.uploaded &&
                  !image.uploading && (
                    <View className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-1">

                      <Text className="text-[8px] font-bold text-white">
                        ✓ Saved
                      </Text>

                    </View>
                  )}

                {/* REMOVE */}

                <Pressable
                  disabled={
                    image.uploading
                  }
                  onPress={() =>
                    onRemove(
                      image.id
                    )
                  }
                  className="absolute right-1.5 top-1.5 h-7 w-7 items-center justify-center rounded-full bg-black/60"
                >

                  <Text className="text-[15px] font-bold text-white">
                    ×
                  </Text>

                </Pressable>

              </View>
            )
          )}

        </View>
      )}

      {/* ADD BUTTON */}

      {images.length <
        maxImages && (
        <Pressable
          onPress={() =>
            onAdd(type)
          }
          className="mt-3 flex-row items-center justify-center rounded-[16px] border border-[#DCE4ED] bg-[#F8FAFC] py-4"
        >

          <View className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-[#EAF2FF]">
            <Text className="text-[20px] text-[#2563EB]">
              +
            </Text>
          </View>

          <Text className="text-[13px] font-extrabold text-[#2563EB]">
            Add Photos
          </Text>

        </Pressable>
      )}

    </View>
  );
}