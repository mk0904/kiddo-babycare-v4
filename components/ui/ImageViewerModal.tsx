import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
const ImageViewer: any = require('react-native-image-zoom-viewer').default;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerModalProps {
    visible: boolean;
    images: string[];
    initialIndex?: number;
    onClose: () => void;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ visible, images, initialIndex = 0, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const flatListRef = useRef<FlatList>(null);
    const thumbnailListRef = useRef<FlatList>(null);

    const safeImages = Array.isArray(images) ? images : [];

    useEffect(() => {
        if (visible && safeImages.length > 0) {
            setCurrentIndex(initialIndex);
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                    index: initialIndex,
                    animated: false,
                });
                scrollThumbnailToIndex(initialIndex);
            }, 100);
        }
    }, [visible, initialIndex, safeImages.length]);

    const scrollThumbnailToIndex = (index: number) => {
        if (thumbnailListRef.current && safeImages.length > 0) {
            const itemWidth = 80 + 8;
            const offset = Math.max(0, (index - 2) * itemWidth);
            thumbnailListRef.current.scrollToOffset({
                offset,
                animated: true,
            });
        }
    };

    const handleImageScroll = (event: any) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const offset = event.nativeEvent.contentOffset.x;
        if (slideSize === 0 || offset === undefined) return;

        const index = Math.round(offset / slideSize);
        if (index >= 0 && index < safeImages.length && index !== currentIndex) {
            setCurrentIndex(index);
            scrollThumbnailToIndex(index);
        }
    };

    const handleThumbnailPress = (index: number) => {
        setCurrentIndex(index);
        flatListRef.current?.scrollToIndex({
            index,
            animated: true,
        });
        scrollThumbnailToIndex(index);
    };

    if (!visible || safeImages.length === 0) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <StatusBar barStyle="light-content" />
            <View style={styles.container}>
                <SafeAreaView style={styles.closeButtonContainer}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                </SafeAreaView>

                <ImageViewer
                    imageUrls={safeImages.map((url) => ({ url }))}
                    index={currentIndex}
                    onChange={(index: number) => {
                        setCurrentIndex(index);
                        scrollThumbnailToIndex(index);
                    }}
                    enableSwipeDown={true}
                    onSwipeDown={onClose}
                    renderIndicator={() => null}
                    saveToLocalByLongPress={false}
                />

                {safeImages.length > 1 && (
                    <View style={styles.thumbnailContainer}>
                        <FlatList
                            ref={thumbnailListRef}
                            data={safeImages}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.thumbnailContent}
                            keyExtractor={(_, index) => `thumb-${index}`}
                            renderItem={({ item, index }) => {
                                const isActive = index === currentIndex;
                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.thumbnailWrapper,
                                            isActive && styles.thumbnailWrapperActive,
                                        ]}
                                        onPress={() => handleThumbnailPress(index)}
                                        activeOpacity={0.8}
                                    >
                                        <Image
                                            source={{ uri: item }}
                                            style={[
                                                styles.thumbnail,
                                                isActive && styles.thumbnailActive,
                                            ]}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                )}

                {safeImages.length > 1 && (
                    <View style={styles.counterContainer}>
                        <View style={styles.counterBackground}>
                            <Ionicons name="images" size={16} color="#fff" />
                            <Text style={styles.counterText}>
                                {currentIndex + 1} / {safeImages.length}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    closeButtonContainer: {
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 10,
        padding: 16,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    thumbnailContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingVertical: 16,
        paddingHorizontal: 8,
    },
    thumbnailContent: {
        paddingHorizontal: 8,
    },
    thumbnailWrapper: {
        width: 80,
        height: 80,
        marginHorizontal: 4,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'transparent',
        overflow: 'hidden',
        backgroundColor: '#333',
    },
    thumbnailWrapperActive: {
        borderColor: '#fff',
        borderWidth: 3,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        opacity: 0.6,
    },
    thumbnailActive: {
        opacity: 1,
    },
    counterContainer: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 5,
    },
    counterBackground: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    counterText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default ImageViewerModal;
