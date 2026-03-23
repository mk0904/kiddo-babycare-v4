import { ProductVariantSelector } from '@/components/product/ProductVariantSelector';
import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface VariantSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    product: any;
    onAddToCart: (variant: any) => void;
}

export const VariantSelectionModal: React.FC<VariantSelectionModalProps> = ({
    visible,
    onClose,
    product,
    onAddToCart,
}) => {
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    const variants = useMemo(() => {
        if (!product?.variants) return [];
        if (Array.isArray(product.variants.edges)) {
            return product.variants.edges.map((e: any) => e.node || e);
        }
        if (Array.isArray(product.variants)) {
            return product.variants;
        }
        return [];
    }, [product]);

    const options = useMemo(() => {
        if (product?.options && Array.isArray(product.options) && product.options.length > 0) {
            return product.options;
        }

        // Fallback: derive options from variants
        if (variants.length > 0) {
            const firstVariant = variants[0];
            if (firstVariant.selectedOptions) {
                const derived: Record<string, Set<string>> = {};
                variants.forEach((v: any) => {
                    const options = v.selectedOptions || [];
                    options.forEach((opt: any) => {
                        if (!derived[opt.name]) derived[opt.name] = new Set();
                        derived[opt.name].add(opt.value);
                    });
                });
                return Object.keys(derived).map(name => ({
                    name,
                    values: Array.from(derived[name])
                })).filter(opt => !(opt.name === 'Title' && opt.values.includes('Default Title')));
            }
        }

        return [];
    }, [product, variants]);

    // If options are empty but we have multiple variants, something is wrong or
    // it's just "Default Title" which we should probably avoid showing a modal for
    useEffect(() => {
        if (visible && options.length === 0 && variants.length > 0) {
            // If it's just one variant with Default Title, just add it directly
            if (variants.length === 1) {
                onAddToCart(variants[0]);
                onClose();
            }
        }
    }, [visible, options, variants, onAddToCart, onClose]);

    // Initialize selected options with the first available variant's options
    useEffect(() => {
        if (visible && product && options.length > 0) {
            const firstAvailable = variants.find((v: any) => v.availableForSale) || variants[0];
            if (firstAvailable) {
                const initialOptions: Record<string, string> = {};
                if (firstAvailable.selectedOptions) {
                    firstAvailable.selectedOptions.forEach((opt: any) => {
                        initialOptions[opt.name] = opt.value;
                    });
                }
                setSelectedOptions(initialOptions);
            }
        }
    }, [visible, product, options, variants]);

    const selectedVariant = useMemo(() => {
        if (!variants || variants.length === 0) return null;
        return variants.find((variant: any) => {
            return variant.selectedOptions.every(
                (opt: any) => selectedOptions[opt.name] === opt.value
            );
        });
    }, [variants, selectedOptions]);

    const handleSelectOption = (name: string, value: string) => {
        setSelectedOptions((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleAdd = async () => {
        if (selectedVariant) {
            setLoading(true);
            try {
                await onAddToCart(selectedVariant);
                onClose();
            } finally {
                setLoading(false);
            }
        }
    };

    if (!product) return null;

    const variantImage = selectedVariant?.image?.url || product.images?.[0]?.url || product.images?.edges?.[0]?.node?.url || product.featuredImage?.url;
    const price = selectedVariant?.price?.amount || product.priceRange?.minVariantPrice?.amount || '0';

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <TouchableOpacity
                    style={styles.dismissArea}
                    activeOpacity={1}
                    onPress={onClose}
                />
                <View style={styles.modalContent}>
                    <SafeAreaView style={styles.safeArea}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>Select Variant</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                            {/* Product Info */}
                            <View style={styles.productInfo}>
                                <Image source={{ uri: variantImage }} style={styles.productImage} />
                                <View style={styles.productText}>
                                    <Text style={styles.productTitle} numberOfLines={2}>
                                        {product.title}
                                    </Text>
                                    <Text style={styles.productPrice}>
                                        ₹{parseFloat(price).toFixed(0)}
                                    </Text>
                                    {selectedVariant && (
                                        <Text style={styles.stockStatus}>
                                            {selectedVariant.availableForSale ? (
                                                <Text style={styles.inStock}>In Stock</Text>
                                            ) : (
                                                <Text style={styles.outOfStock}>Out of Stock</Text>
                                            )}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {/* Options */}
                            <ProductVariantSelector
                                options={options}
                                selectedOptions={selectedOptions}
                                onSelectOption={handleSelectOption}
                            />
                        </ScrollView>

                        {/* Footer Action */}
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[
                                    styles.addButton,
                                    (!selectedVariant || !selectedVariant.availableForSale) && styles.disabledButton
                                ]}
                                onPress={handleAdd}
                                disabled={!selectedVariant || !selectedVariant.availableForSale || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.addButtonText}>Add to Cart</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    dismissArea: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    safeArea: {
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.LexendBold,
        color: Colors.text,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    productInfo: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 16,
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    productText: {
        flex: 1,
        justifyContent: 'center',
    },
    productTitle: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: Colors.primary,
        marginBottom: 4,
    },
    stockStatus: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
    },
    inStock: {
        color: '#10B981',
    },
    outOfStock: {
        color: '#EF4444',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#fff',
    },
    addButton: {
        height: 54,
        backgroundColor: Colors.primary,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    addButtonText: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#fff',
    },
    disabledButton: {
        backgroundColor: '#D1D5DB',
    },
});
