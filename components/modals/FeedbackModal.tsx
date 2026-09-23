import BaseModal from '@/components/ui/BaseModal';
import { Colors, Fonts } from '@/constants/theme';
import { clevertapService } from '@/services/clevertapService';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export interface FeedbackItem {
    id: string;
    name: string;
}

interface FeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string) => Promise<void>;
    orderId?: string;
    items?: FeedbackItem[];
}

const RATING_OPTIONS = [1, 2, 3, 4, 5];
const POSITIVE_TAGS = ['Amazing quality', 'Timely delivery', 'Perfect Fit', 'Value for money', 'Great packaging', 'Tell us more...'];
const NEGATIVE_TAGS = ['Bad quality', 'Size or fit issue', 'Damaged item', 'Wrong item', 'Late delivery', 'Tell us more...'];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
    visible,
    onClose,
    onSubmit,
    orderId,
    items = [],
}) => {
    const [rating, setRating] = useState<number>(0);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [itemRatings, setItemRatings] = useState<Record<string, 'up' | 'down' | null>>({});
    const [deliveryRating, setDeliveryRating] = useState<'up' | 'down' | null>(null);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            return;
        }

        setSubmitting(true);
        try {
            const commentStr = JSON.stringify({
                text: comment,
                tags: selectedTags,
                items: itemRatings,
                delivery: deliveryRating
            });

            // Track CleverTap events after submit button is clicked
            // Event 1: Rating submitted
            clevertapService.recordEvent('Feedback Rating Submitted', {
                orderId: orderId,
                rating: rating,
                ratingType: rating <= 3 ? 'Negative' : 'Positive'
            });

            // Event 2: Review feedback details (text and tags)
            if (comment || selectedTags.length > 0) {
                clevertapService.recordEvent('Feedback Review Submitted', {
                    orderId: orderId,
                    feedbackText: comment,
                    selectedTags: selectedTags,
                    itemRatings: itemRatings,
                    deliveryRating: deliveryRating,
                    hasFeedbackText: comment.length > 0,
                    feedbackTextLength: comment.length,
                    numberOfTags: selectedTags.length
                });
            }

            await onSubmit(rating, commentStr);
            handleClose();
        } catch (error) {
            console.error('Error submitting feedback:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setRating(0);
        setSelectedTags([]);
        setItemRatings({});
        setDeliveryRating(null);
        setComment('');
        onClose();
    };

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const getItemIcon = (name: string) => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('set') || lowerName.includes('shirt') || lowerName.includes('dress') || lowerName.includes('clothes')) {
            return { name: 'shirt-outline' as const, color: '#F43F5E', bg: '#FFE4E6' }; // Pinkish
        }
        return { name: 'cube-outline' as const, color: '#3B82F6', bg: '#DBEAFE' }; // Bluish for toys/others
    };

    const isLowRating = rating > 0 && rating <= 3;
    const isErrorState = isLowRating || Object.values(itemRatings).includes('down') || deliveryRating === 'down';
    const activeTags = isLowRating ? NEGATIVE_TAGS : POSITIVE_TAGS;

    const handleRatingChange = (value: number) => {
        const wasLow = rating > 0 && rating <= 3;
        const willBeLow = value > 0 && value <= 3;
        if (wasLow !== willBeLow) {
            setSelectedTags([]);
            setComment('');
        }
        setRating(value);
    };

    return (
        <BaseModal
            visible={visible}
            onClose={handleClose}
            type="bottomSheet"
            closeButtonPosition="above"
            showDragHandle
            containerStyle={styles.modalContainer}
            contentStyle={styles.modalContent}
        >
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentInner}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                <View style={styles.titleContainer}>
                    <Text style={styles.titleText}>How was your</Text>
                    <Text style={styles.titleHighlight}>Kiddo experience?</Text>
                </View>

                <Text style={styles.subtitle}>
                    Your order arrived in <Text style={styles.subtitleBold}>41 minutes</Text>
                </Text>

                <View style={styles.ratingContainer}>
                    {RATING_OPTIONS.map((value) => (
                        <TouchableOpacity
                            key={value}
                            style={styles.starButton}
                            onPress={() => handleRatingChange(value)}
                            activeOpacity={0.7}
                        >
                            <Image
                                source={
                                    rating >= value
                                        ? require('@/assets/icons/rating.png')
                                        : require('@/assets/icons/inactiveratingstar.png')
                                }
                                style={styles.starImage}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                {rating > 0 && (
                    <View style={styles.tagsContainer}>
                        {activeTags.map(tag => (
                            <TouchableOpacity
                                key={tag}
                                style={[
                                    styles.tagPill,
                                    selectedTags.includes(tag) && styles.tagPillSelected
                                ]}
                                onPress={() => toggleTag(tag)}
                            >
                                <Text
                                    style={[
                                        styles.tagText,
                                        selectedTags.includes(tag) && styles.tagTextSelected
                                    ]}
                                    numberOfLines={1}
                                >
                                    {tag}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {selectedTags.includes('Tell us more...') && (
                    <View style={styles.commentContainer}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder={isLowRating ? 'Tell us what went wrong' : 'Tell us more'}
                            placeholderTextColor={Colors.textSecondary}
                            multiline
                            numberOfLines={3}
                            value={comment}
                            onChangeText={setComment}
                            maxLength={300}
                            textAlignVertical="top"
                        />
                        <Text style={styles.charCount}>{comment.length}/300</Text>
                    </View>
                )}

                <View style={styles.card}>
                    {items.length > 0 && (
                        <View style={styles.cardSection}>
                            <Text style={styles.sectionTitle}>How were the items?</Text>
                            {items.map((item, index) => {
                                const iconProps = getItemIcon(item.name);
                                return (
                                    <View
                                        key={item.id}
                                        style={[
                                            styles.itemRow,
                                            index === items.length - 1 && styles.itemRowLast,
                                        ]}
                                    >
                                        <View style={styles.itemInfo}>
                                            <View style={[styles.itemIconContainer, { backgroundColor: iconProps.bg }]}>
                                                <Ionicons name={iconProps.name} size={18} color={iconProps.color} />
                                            </View>
                                            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                                        </View>
                                        <View style={styles.thumbsContainer}>
                                            <TouchableOpacity
                                                style={[styles.thumbButton, itemRatings[item.id] === 'down' && styles.thumbButtonActiveDown]}
                                                onPress={() => setItemRatings({ ...itemRatings, [item.id]: 'down' })}
                                            >
                                                <Ionicons name="thumbs-down" size={16} color={itemRatings[item.id] === 'down' ? '#FFF' : '#EF4444'} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.thumbButton, itemRatings[item.id] === 'up' && styles.thumbButtonActiveUp]}
                                                onPress={() => setItemRatings({ ...itemRatings, [item.id]: 'up' })}
                                            >
                                                <Ionicons name="thumbs-up" size={16} color={itemRatings[item.id] === 'up' ? '#FFF' : '#10B981'} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={[styles.cardSection, items.length > 0 && styles.cardSectionBorder]}>
                        <View style={[styles.itemRow, styles.itemRowLast]}>
                            <View style={styles.deliveryInfo}>
                                <Text style={styles.sectionTitle}>How was your delivery?</Text>
                                <Text style={styles.deliveryText}>
                                    Delivered by <Text style={styles.deliveryName}>Rohit Verma</Text>
                                </Text>
                            </View>
                            <View style={styles.thumbsContainer}>
                                <TouchableOpacity
                                    style={[styles.thumbButton, deliveryRating === 'down' && styles.thumbButtonActiveDown]}
                                    onPress={() => setDeliveryRating('down')}
                                >
                                    <Ionicons name="thumbs-down" size={16} color={deliveryRating === 'down' ? '#FFF' : '#EF4444'} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.thumbButton, deliveryRating === 'up' && styles.thumbButtonActiveUp]}
                                    onPress={() => setDeliveryRating('up')}
                                >
                                    <Ionicons name="thumbs-up" size={16} color={deliveryRating === 'up' ? '#FFF' : '#10B981'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                {isErrorState && (
                    <View style={styles.warningBox}>
                        <Ionicons name="headset-outline" size={18} color="#E11D48" />
                        <Text style={styles.warningText}>
                            Sorry this went wrong. Our team will look into it and reach out to sort it for you.
                        </Text>
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={rating === 0 || submitting}
                    activeOpacity={0.8}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <Text style={styles.submitButtonText}>
                            {isErrorState ? 'Submit and get help' : 'Submit'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        maxHeight: '88%',
    },
    modalContent: {
        flexShrink: 1,
    },
    content: {
        flexGrow: 0,
        flexShrink: 1,
    },
    contentInner: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 12,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: 4,
    },
    titleText: {
        fontSize: 22,
        lineHeight: 28,
        fontFamily: Fonts.LexendBold,
        color: Colors.text,
    },
    titleHighlight: {
        fontSize: 22,
        lineHeight: 28,
        fontFamily: Fonts.LexendBold,
        color: Colors.primary,
    },
    subtitle: {
        fontSize: 13,
        lineHeight: 18,
        fontFamily: Fonts.LexendRegular,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitleBold: {
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
    },
    ratingContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
        marginBottom: 16,
    },
    starButton: {
        padding: 2,
    },
    starImage: {
        width: 44,
        height: 44,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 8,
        marginBottom: 14,
    },
    tagPill: {
        width: '32%',
        paddingHorizontal: 4,
        paddingVertical: 8,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E8EAEE',
        backgroundColor: '#F7F8FA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagPillSelected: {
        backgroundColor: '#FFF5F5',
        borderColor: Colors.primary,
    },
    tagText: {
        fontSize: 11,
        fontFamily: Fonts.LexendMedium,
        color: Colors.text,
        textAlign: 'center',
    },
    tagTextSelected: {
        color: Colors.primary,
    },
    commentContainer: {
        backgroundColor: '#F7F8FA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EEEFF3',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 8,
        marginBottom: 14,
    },
    commentInput: {
        fontFamily: Fonts.LexendRegular,
        fontSize: 14,
        color: Colors.text,
        minHeight: 64,
        padding: 0,
    },
    charCount: {
        fontFamily: Fonts.LexendRegular,
        fontSize: 11,
        color: Colors.textSecondary,
        textAlign: 'right',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#F7F8FA',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingTop: 4,
        paddingBottom: 4,
        marginBottom: 12,
    },
    cardSection: {
        paddingVertical: 12,
    },
    cardSectionBorder: {
        borderTopWidth: 1,
        borderTopColor: '#ECEEF2',
    },
    sectionTitle: {
        fontSize: 14,
        lineHeight: 18,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
        marginBottom: 2,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    itemRowLast: {
        marginBottom: 0,
    },
    itemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 12,
    },
    itemIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemName: {
        fontSize: 13,
        lineHeight: 18,
        fontFamily: Fonts.LexendMedium,
        color: Colors.text,
        flex: 1,
    },
    deliveryInfo: {
        flex: 1,
        paddingRight: 12,
        justifyContent: 'center',
    },
    deliveryText: {
        fontSize: 12,
        lineHeight: 16,
        fontFamily: Fonts.LexendRegular,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    deliveryName: {
        fontFamily: Fonts.LexendMedium,
        color: Colors.text,
    },
    thumbsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    thumbButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8EAEE',
    },
    thumbButtonActiveUp: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    thumbButtonActiveDown: {
        backgroundColor: Colors.error,
        borderColor: Colors.error,
    },
    warningBox: {
        backgroundColor: '#FFF1F2',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 4,
    },
    warningText: {
        color: '#BE123C',
        fontSize: 12,
        flex: 1,
        fontFamily: Fonts.LexendRegular,
        lineHeight: 18,
    },
    footer: {
        paddingHorizontal: 20,
        paddingBottom: 28,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F0F2F5',
        backgroundColor: Colors.backgroundWhite,
    },
    submitButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        backgroundColor: '#F7A3A2',
    },
    submitButtonText: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#FFF',
    },
});

