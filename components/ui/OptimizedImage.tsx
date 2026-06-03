import React, { useState } from 'react';
import { View, StyleSheet, ImageStyle, StyleProp } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import SkeletonLoader from './SkeletonLoader';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
    source: { uri: string } | number; // expo-image source can be more complex, but sticking to basics for now
    style?: StyleProp<ImageStyle>;
    showSkeleton?: boolean;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
    source,
    style,
    showSkeleton = false,
    ...props
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const handleLoadStart = () => {
        setLoading(true);
        setError(false);
    };

    const handleLoadEnd = () => {
        setLoading(false);
    };

    const handleError = () => {
        setLoading(false);
        setError(true);
    };

    return (
        <View style={[styles.container, style]}>
            {showSkeleton && loading && !error && (
                <View style={[StyleSheet.absoluteFill, styles.skeletonContainer]}>
                    <SkeletonLoader
                        width="100%"
                        height="100%"
                        borderRadius={0}
                        style={StyleSheet.absoluteFill}
                    />
                </View>
            )}
            <Image
                source={source}
                style={[
                    StyleSheet.absoluteFill as any,
                    // style can be passed but typically we want the image to fill the container defined by style prop on View
                ]}
                onLoadStart={handleLoadStart}
                onLoad={handleLoadEnd}
                onError={handleError}
                transition={0} // No artificial fade-in delay
                {...props}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: '#f0f0f0', // Placeholder bg
    },
    skeletonContainer: {
        zIndex: 1,
    },
});

export default OptimizedImage;
