import { Button } from '@/components/ui/Button';
import { Colors, Fonts } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ItemDetails } from './types';

interface StepReasonSelectionProps {
    order: any;
    selectedItems: string[];
    initialDetails: Record<string, ItemDetails>;
    onNext: (details: Record<string, ItemDetails>) => void;
}

const CANCEL_REASONS = [
    'Changed my mind',
    'Placed order by mistake',
    'Missing parts',
    'Poor quality/ Damaged product',
    'My reason not listed',
];

export const StepReasonSelection: React.FC<StepReasonSelectionProps> = ({
    order,
    selectedItems,
    initialDetails,
    onNext,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [details, setDetails] = useState<Record<string, ItemDetails>>(initialDetails);

    // Current item state
    const currentItemId = selectedItems[currentIndex];
    const currentEdge = order?.lineItems?.edges?.find((e: any) =>
        (e.node.id || e.node.variant?.id) === currentItemId
    );
    const item = currentEdge?.node;

    const savedDetail = details[currentItemId] || { type: 'Return' };
    const [type, setType] = useState<'Return' | 'Exchange'>(savedDetail.type);

    // Return State
    const [selectedReason, setSelectedReason] = useState<string | null>(savedDetail.reason || null);
    const [customReason, setCustomReason] = useState(savedDetail.reason && !CANCEL_REASONS.includes(savedDetail.reason) ? savedDetail.reason : '');
    const [images, setImages] = useState<any[]>(savedDetail.images || []);
    const [imageError, setImageError] = useState<string | null>(null);

    // Exchange State
    const [loadingProduct, setLoadingProduct] = useState(false);
    const [productData, setProductData] = useState<any>(null);
    const [selectedSize, setSelectedSize] = useState<string | null>(savedDetail.size || null);
    const [selectedColor, setSelectedColor] = useState<string | null>(savedDetail.color || null);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(savedDetail.variant?.id || null);

    // Reset local state when item changes
    useEffect(() => {
        const d = details[currentItemId] || { type: 'Return' };
        setType(d.type);
        setSelectedReason(d.type === 'Return' ? (d.reason || null) : null);
        setCustomReason(d.type === 'Return' && d.reason && !CANCEL_REASONS.includes(d.reason) ? d.reason : '');
        setImages(d.type === 'Return' ? (d.images || []) : []);
        setImageError(null);
        setSelectedSize(d.type === 'Exchange' ? (d.size || null) : null);
        setSelectedColor(d.type === 'Exchange' ? (d.color || null) : null);
        setSelectedVariantId(d.type === 'Exchange' ? (d.variant?.id || null) : null);
    }, [currentIndex, currentItemId]);

    // Fetch product variants for exchange
    useEffect(() => {
        if (type === 'Exchange' && item?.variant?.product?.id) {
            setLoadingProduct(true);
            shopifyApi.getProductById(item.variant.product.id).then((res) => {
                if (res) setProductData(res);
                setLoadingProduct(false);
            }).catch(() => setLoadingProduct(false));
        }
    }, [type, item]);

    const handleProceed = () => {
        let currentDetail: ItemDetails = { type };

        if (type === 'Return') {
            currentDetail.reason = selectedReason === 'My reason not listed' ? customReason.trim() : (selectedReason || '');
            if (['Poor quality/ Damaged product', 'Missing parts'].includes(currentDetail.reason || '')) {
                currentDetail.images = images;
            }
        } else {
            currentDetail.size = selectedSize || undefined;
            currentDetail.color = selectedColor || undefined;
            // Find selected variant from productData if needed
            if (productData?.variants?.edges) {
                const variantNode = productData.variants.edges.find((e: any) => e.node.id === selectedVariantId)?.node;
                if (variantNode) currentDetail.variant = variantNode;
            }
        }

        const newDetails = {
            ...details,
            [currentItemId]: currentDetail
        };

        setDetails(newDetails);

        if (currentIndex < selectedItems.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            onNext(newDetails);
        }
    };

    const isProceedDisabled = () => {
        if (type === 'Return') {
            if (!selectedReason) return true;
            if (selectedReason === 'My reason not listed' && !customReason.trim()) return true;
            if (['Poor quality/ Damaged product', 'Missing parts'].includes(selectedReason) && images.length === 0) return true;
            if (imageError) return true;
            return false;
        } else {
            // Mock exchange validation
            return !selectedVariantId;
        }
    };

    const handleAddProof = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Photo Library', 'Take Photo or Video', 'Choose File'],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) pickImage(false);
                    else if (buttonIndex === 2) pickImage(true);
                    else if (buttonIndex === 3) pickDocument();
                }
            );
        } else {
            Alert.alert(
                'Attach proof',
                'Select source',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Photo Library', onPress: () => pickImage(false) },
                    { text: 'Take Photo or Video', onPress: () => pickImage(true) },
                    { text: 'Choose File', onPress: () => pickDocument() },
                ]
            );
        }
    };

    const processFile = (file: any) => {
        if (file.size && file.size > 5 * 1024 * 1024) {
            setImageError('File size should be <5MB');
            return;
        }
        setImageError(null);
        setImages((prev) => [...prev, file]);
    };

    const pickImage = async (camera: boolean) => {
        try {
            let result;
            if (camera) {
                const p = await ImagePicker.requestCameraPermissionsAsync();
                if (p.status !== 'granted') return;
                result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images' });
            } else {
                result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images' });
            }
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                processFile({
                    uri: asset.uri,
                    name: asset.fileName || 'image.jpg',
                    size: asset.fileSize || 0,
                    type: asset.mimeType || 'image/jpeg',
                });
            }
        } catch (e) {
            console.log(e);
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/png', 'image/jpeg'],
            });
            if (result.canceled === false && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                processFile({
                    uri: asset.uri,
                    name: asset.name,
                    size: asset.size || 0,
                    type: asset.mimeType || 'image/jpeg',
                });
            }
        } catch (e) {
            console.log(e);
        }
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
        setImageError(null);
    };

    if (!item) return null;

    const imgUrl = item.variant?.image?.url;
    const price = parseFloat(item.originalTotalPrice?.amount || item.price?.amount || '0');

    const orderedId = item.variant?.id;

    // Parse variants if productData is available, filtering out out-of-stock items unless it's the ordered variant
    const variants = productData?.variants?.edges
        ?.map((e: any) => e.node)
        ?.filter((v: any) => v.availableForSale || v.id === orderedId) || [];

    // Group variants for UI if options exist, otherwise just list variants
    // Here we'll do a simple variant selection pill list for demonstration
    const variantOptions = variants.map((v: any) => ({
        id: v.id,
        title: v.title,
    }));

    // Auto-select ordered variant if available
    useEffect(() => {
        if (type === 'Exchange' && productData) {
            const orderedId = item?.variant?.id;
            const availableVariants = productData.variants?.edges
                ?.map((e: any) => e.node)
                ?.filter((v: any) => v.availableForSale || v.id === orderedId) || [];
            
            setSelectedVariantId((current) => {
                const currentValid = availableVariants.some((v: any) => v.id === current);
                if (!currentValid) {
                    if (orderedId && availableVariants.some((v: any) => v.id === orderedId)) {
                        return orderedId;
                    }
                    return null;
                }
                return current;
            });
        }
    }, [productData, type, currentItemId, item?.variant?.id]);

    return (
        <View style={styles.container}>
            {/* Progress Bar Area */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${((currentIndex + 1) / selectedItems.length) * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>Item {currentIndex + 1}/{selectedItems.length}</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* Item Card */}
                <View style={styles.itemCard}>
                    {imgUrl ? (
                        <Image source={{ uri: imgUrl }} style={styles.itemImage} />
                    ) : (
                        <View style={[styles.itemImage, styles.placeholderImg]}>
                            <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                        </View>
                    )}
                    <View style={styles.itemInfo}>
                        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.priceText}>
                            ₹{price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tab, type === 'Exchange' && styles.tabActive]}
                        onPress={() => setType('Exchange')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, type === 'Exchange' && styles.tabTextActive]}>Exchange</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, type === 'Return' && styles.tabActive]}
                        onPress={() => setType('Return')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, type === 'Return' && styles.tabTextActive]}>Return</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.disclaimerBox}>
                    <Text style={styles.disclaimerText}>
                        Please note: Products must be unused and have all original tags attached to qualify for a return or exchange.
                    </Text>
                </View>

                {type === 'Return' ? (
                    <View style={styles.returnSection}>
                        <Text style={styles.sectionTitle}>What went wrong?</Text>
                        {CANCEL_REASONS.map((reason) => {
                            const isSelected = selectedReason === reason;
                            return (
                                <View key={reason} style={styles.reasonContainer}>
                                    <TouchableOpacity
                                        style={styles.reasonRow}
                                        activeOpacity={0.7}
                                        onPress={() => setSelectedReason(reason)}
                                    >
                                        <Text style={styles.reasonText}>{reason}</Text>
                                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                                            {isSelected && <View style={styles.radioInner} />}
                                        </View>
                                    </TouchableOpacity>
                                    {isSelected && reason === 'My reason not listed' && (
                                        <TextInput
                                            style={styles.customInput}
                                            placeholder="Write your reason here"
                                            placeholderTextColor="#9CA3AF"
                                            value={customReason}
                                            onChangeText={setCustomReason}
                                            multiline
                                        />
                                    )}
                                </View>
                            );
                        })}

                        {['Poor quality/ Damaged product', 'Missing parts'].includes(selectedReason || '') && (
                            <View style={styles.proofContainer}>
                                <Text style={styles.sectionTitle}>Attach proof*</Text>

                                {images.length === 0 ? (
                                    <View style={styles.uploadRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.uploadTitle}>Upload a file</Text>
                                            <Text style={styles.uploadSubtitle}>PNG, JPG, Upto 5MB</Text>
                                            {imageError && <Text style={styles.errorText}>⊗ {imageError}</Text>}
                                        </View>
                                        <TouchableOpacity style={styles.selectFileBtn} onPress={handleAddProof}>
                                            <Text style={styles.selectFileText}>Select file</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View>
                                        {images.map((img, idx) => (
                                            <View key={idx} style={styles.uploadedFileRow}>
                                                <Image source={{ uri: img.uri }} style={styles.uploadedThumbnail} />
                                                <View style={styles.uploadedFileInfo}>
                                                    <Text style={styles.uploadedFileName} numberOfLines={1}>{img.name}</Text>
                                                    <Text style={styles.uploadedFileSize}>
                                                        {(img.size / (1024 * 1024)).toFixed(1)}MB
                                                    </Text>
                                                </View>
                                                <TouchableOpacity onPress={() => removeImage(idx)} style={{ padding: 4 }}>
                                                    <Text style={styles.removeText}>Remove</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}

                                        <View style={styles.uploadRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.uploadTitle}>Add another file</Text>
                                                <Text style={styles.uploadSubtitle}>PNG, JPG, Upto 5MB</Text>
                                                {imageError && <Text style={styles.errorText}>⊗ {imageError}</Text>}
                                            </View>
                                            <TouchableOpacity style={styles.selectFileBtn} onPress={handleAddProof}>
                                                <Text style={styles.selectFileText}>Select file</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.exchangeSection}>
                        {loadingProduct ? (
                            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 24 }} />
                        ) : (
                            <View>
                                <Text style={styles.sectionTitle}>Select Variant</Text>
                                <View style={styles.pillContainer}>
                                    {variantOptions.map((v: any) => {
                                        const isSelected = selectedVariantId === v.id;
                                        return (
                                            <TouchableOpacity
                                                key={v.id}
                                                style={[styles.pill, isSelected && styles.pillSelected]}
                                                onPress={() => setSelectedVariantId(v.id)}
                                            >
                                                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                                                    {v.title}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                {variantOptions.length === 0 && !loadingProduct && (
                                    <Text style={styles.emptyText}>No variants found for exchange.</Text>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    title="Proceed"
                    onPress={handleProceed}
                    disabled={isProceedDisabled()}
                    style={[styles.proceedBtn, isProceedDisabled() && styles.proceedBtnDisabled]}
                    textStyle={styles.proceedBtnText}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    progressContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    progressText: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: '#717680',
        marginTop: 12,
        paddingHorizontal: 6,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#F05A5D',
    },
    scroll: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingBottom: 24,
    },
    itemCard: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    itemImage: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        marginRight: 12,
    },
    placeholderImg: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    itemTitle: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#1F2937',
        lineHeight: 18,
    },
    priceText: {
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
        color: '#111827',
        marginTop: 4,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 100,
        padding: 4,
        marginHorizontal: 20,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        marginBottom: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 100,
    },
    tabActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    tabText: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
    },
    tabTextActive: {
        color: '#F05A5D',
        fontFamily: Fonts.LexendSemiBold,
    },
    disclaimerBox: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#F9FAFB',
    },
    disclaimerText: {
        fontSize: 12,
        fontFamily: Fonts.LexendRegular,
        color: '#6B7280',
        lineHeight: 18,
    },
    returnSection: {
        paddingTop: 24,
    },
    exchangeSection: {
        paddingTop: 24,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 15,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    reasonContainer: {
        paddingHorizontal: 20,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    reasonText: {
        fontFamily: Fonts.LexendMedium,
        fontSize: 14,
        color: '#181D27',
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuterSelected: {
        borderColor: '#F05A5D',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#F05A5D',
    },
    customInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontFamily: Fonts.LexendMedium,
        fontSize: 14,
        color: '#1F2937',
        marginTop: 4,
        marginBottom: 16,
        minHeight: 48,
        textAlignVertical: 'top',
        backgroundColor: '#FFFFFF',
    },
    pillContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 12,
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    pillSelected: {
        borderColor: '#F05A5D',
        backgroundColor: '#FFF5F5',
    },
    pillText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
    },
    pillTextSelected: {
        color: '#F05A5D',
    },
    emptyText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
        marginTop: 12,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    proceedBtn: {
        backgroundColor: '#F05A5D',
        borderRadius: 16,
        height: 52,
    },
    proceedBtnDisabled: {
        backgroundColor: '#F3F4F6',
    },
    proceedBtnText: {
        fontFamily: Fonts.LexendSemiBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
    proofContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    uploadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    uploadTitle: {
        fontSize: 13,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
    },
    uploadSubtitle: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
        marginTop: 2,
    },
    selectFileBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F05A5D',
    },
    selectFileText: {
        color: '#F05A5D',
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
    },
    errorText: {
        color: '#F05A5D',
        fontSize: 11,
        fontFamily: Fonts.LexendMedium,
        marginTop: 4,
    },
    uploadedFileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    uploadedThumbnail: {
        width: 40,
        height: 40,
        borderRadius: 4,
        marginRight: 12,
    },
    uploadedFileInfo: {
        flex: 1,
    },
    uploadedFileName: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        color: '#111827',
    },
    uploadedFileSize: {
        fontSize: 11,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
        marginTop: 2,
    },
    removeText: {
        color: '#F05A5D',
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
    },
});
