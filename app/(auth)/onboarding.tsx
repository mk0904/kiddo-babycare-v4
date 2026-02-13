import { Button } from '@/components/ui/Button';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { customerService } from '@/services/customerService';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    LayoutChangeEvent,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MIN_AGE_MONTHS = 0;
const MAX_AGE_MONTHS = 60; // 5 years = 60 months

// Helper function to format age display
const formatAge = (months: number): string => {
  if (months === 0) return '0 months';
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) {
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
  return `${years} ${years === 1 ? 'year' : 'years'} ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`;
};

// Simple Age Slider Component
const AgeSlider: React.FC<{
  value: number;
  onValueChange: (value: number) => void;
}> = ({ value, onValueChange }) => {
  const [sliderWidth, setSliderWidth] = useState(SCREEN_WIDTH - 80);
  const thumbPosition = useSharedValue(0);

  React.useEffect(() => {
    const range = MAX_AGE_MONTHS - MIN_AGE_MONTHS;
    thumbPosition.value = ((value - MIN_AGE_MONTHS) / range) * sliderWidth;
  }, [value, sliderWidth]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setSliderWidth(width);
      const range = MAX_AGE_MONTHS - MIN_AGE_MONTHS;
      thumbPosition.value = ((value - MIN_AGE_MONTHS) / range) * width;
    }
  };

  const updateValue = (x: number) => {
    const range = MAX_AGE_MONTHS - MIN_AGE_MONTHS;
    let newValue = Math.round((x / sliderWidth) * range) + MIN_AGE_MONTHS;
    newValue = Math.max(MIN_AGE_MONTHS, Math.min(MAX_AGE_MONTHS, newValue));
    onValueChange(newValue);
  };

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      const newX = Math.max(0, Math.min(sliderWidth, e.x));
      thumbPosition.value = newX;
      runOnJS(updateValue)(newX);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbPosition.value - 14 }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbPosition.value,
  }));

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderTrack} onLayout={onLayout}>
        <Animated.View style={[styles.sliderFill, fillStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.sliderThumb, thumbStyle]}>
            <View style={styles.sliderThumbInner} />
          </Animated.View>
        </GestureDetector>
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>0 months</Text>
        <Text style={styles.sliderLabel}>5 years</Text>
      </View>
    </View>
  );
};

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, login } = useAuth();

  const [name, setName] = useState('');
  const [babyName, setBabyName] = useState('');
  const [ageMonths, setAgeMonths] = useState(0);
  const [gender, setGender] = useState<'boy' | 'girl' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your name');
      return;
    }
    if (!babyName.trim()) {
      Alert.alert('Required Field', "Please enter your baby's name");
      return;
    }
    if (!gender) {
      Alert.alert('Required Field', 'Please select gender');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (!user?.customerAccessToken) {
        throw new Error('No access token available');
      }

      // Split name into first and last
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Update customer with name and metafields
      const result = await customerService.updateCustomerWithMetafields(
        user.customerAccessToken,
        {
          firstName,
          lastName,
        },
        {
          baby_name: babyName.trim(),
          age: ageMonths.toString(),
          gender: gender,
        }
      );

      if (result.success) {
        // Track profile created
        try {
          const { trackProfileCreated } = require('@/utils/mixpanelHelpers');
          trackProfileCreated({
            babyAge: ageMonths,
            babyGender: gender,
            babyName: babyName.trim(),
            hasParentInfo: true,
          });
        } catch (e) {
          console.warn('Mixpanel tracking error:', e);
        }

        // Update local user state
        const updatedUser = {
          ...user,
          firstName,
          lastName,
          displayName: name.trim(),
        };
        await login(updatedUser as any);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      } else {
        throw new Error(result.message || 'Failed to save information');
      }
    } catch (error: any) {
      console.error('Error saving onboarding data:', error);
      Alert.alert('Error', error.message || 'Failed to save information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tell us about you</Text>
          <Text style={styles.subtitle}>
            Help us personalize your experience
          </Text>
        </View>

        <View style={styles.form}>
          {/* Your Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Your Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* Baby's Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Baby's Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter baby's name"
              placeholderTextColor={Colors.textSecondary}
              value={babyName}
              onChangeText={setBabyName}
              autoCapitalize="words"
            />
          </View>

          {/* Age Slider */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Age *</Text>
            <View style={styles.ageDisplay}>
              <Text style={styles.ageValue}>{formatAge(ageMonths)}</Text>
            </View>
            <AgeSlider value={ageMonths} onValueChange={setAgeMonths} />
          </View>

          {/* Gender Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Gender *</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'boy' && styles.genderButtonActive,
                ]}
                onPress={() => {
                  setGender('boy');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === 'boy' && styles.genderButtonTextActive,
                  ]}
                >
                  Boy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'girl' && styles.genderButtonActive,
                ]}
                onPress={() => {
                  setGender('girl');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === 'girl' && styles.genderButtonTextActive,
                  ]}
                >
                  Girl
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <Button
            title="Continue"
            onPress={handleSubmit}
            disabled={loading}
            loading={loading}
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.Bold,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.Regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.SemiBold,
    color: Colors.text,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: Fonts.Regular,
    color: Colors.text,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  ageDisplay: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
  },
  ageValue: {
    fontSize: 18,
    fontFamily: Fonts.Bold,
    color: Colors.primary,
  },
  sliderContainer: {
    marginTop: 8,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    position: 'relative',
    width: '100%',
  },
  sliderFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    position: 'absolute',
    top: -12,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderThumbInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.backgroundWhite,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 12,
    fontFamily: Fonts.Regular,
    color: Colors.textSecondary,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: Colors.backgroundWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderButtonText: {
    fontSize: 16,
    fontFamily: Fonts.SemiBold,
    color: Colors.text,
  },
  genderButtonTextActive: {
    color: Colors.backgroundWhite,
  },
  submitButton: {
    marginTop: 20,
  },
});
