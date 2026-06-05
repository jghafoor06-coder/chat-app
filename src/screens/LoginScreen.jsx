import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Alert,
  TouchableOpacity,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

const LoginScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const isFocused = useIsFocused();
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isFocused) return;

    const subscriber = auth().onAuthStateChanged(user => {
      if (user) {
        navigation.replace('Tabnavigation');
      }
    });

    return subscriber;
  }, [navigation, isFocused]);

  // Send OTP
  const sendOTP = async () => {
    try {
      setLoading(true);

      // Check if phone number exists in database
      const snapshot = await database()
        .ref('users')
        .orderByChild('phoneNumber')
        .equalTo(phoneNumber)
        .once('value');

      // If number does not exist
      if (!snapshot.exists()) {
        Alert.alert(
          'Account Not Found',
          'This number is not registered. Please sign up first.',
        );

        setLoading(false);
        return;
      }

      // Send OTP if user exists
      const confirmation = await auth().signInWithPhoneNumber(phoneNumber);

      setConfirm(confirmation);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Confirm OTP
  const confirmCode = async () => {
    if (!confirm) {
      Alert.alert('Error', 'Please request OTP first');
      return;
    }

    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }

    try {
      setLoading(true);
      await confirm.confirm(code.trim());
      navigation.replace('Tabnavigation');
    } catch (error) {
      Alert.alert(
        'Invalid OTP',
        error?.message || 'The code you entered is not valid.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Animated.spring(formAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Animated.View
        style={[
          styles.container,
          {
            opacity: formAnim,
            transform: [
              {
                translateY: formAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        {!confirm ? (
          <>
            <Image
              source={require('../assets/image.png')}
              style={styles.image}
            />
            <Text style={styles.heading}>Welcome back</Text>

            <Text style={styles.subText}>
              Enter your mobile number to continue {'\n'}
              where you left off.
            </Text>

            <TextInput
              placeholder="+923001234567"
              placeholderTextColor={'#bdbec0'}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              style={styles.input}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.loginButton}
              onPress={sendOTP}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.loginButtonText}>Send OTP</Text>
              )}
            </TouchableOpacity>

            <View style={styles.accountContainer}>
              <Text style={styles.accountText}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.accountLink}>Create Account</Text>
              </TouchableOpacity>
            </View>


          </>
        ) : (
          <>
            <Image
              source={require('../assets/image.png')}
              style={styles.image}
            />
            <Text style={styles.heading}> Enter OTP</Text>
            <Text style={styles.otpsubText}>
              Enter the OTP received via SMS to {'\n'} complete verification.
            </Text>
            <TextInput
              placeholder="Enter OTP"
              placeholderTextColor="#bdbec0"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              style={styles.otpInput}
              keyboardType="number-pad"
              textAlign="center"
              letterSpacing={5}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />

            <TouchableOpacity
              style={styles.loginButton}
              onPress={confirmCode}
              activeOpacity={0.7}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.loginButtonText}>Verify OTP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity>
              <Text style={styles.bottomText}>
                Don't have an account?{' '}
                <Text
                  style={styles.accountLink}
                  onPress={() => navigation.navigate('Signup')}
                >
                  Create Account
                </Text>
              </Text>
            </TouchableOpacity>


          </>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },

  image: {
    height: 100,
    width: 100,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginTop: 60,
  },

  heading: {
    color: '#2253e7',
    fontSize: 35,
    fontWeight: '700',
    marginTop: 40,
    marginBottom: 10,
  },

  subText: {
    fontSize: 14,
    marginBottom: 40,
    color: '#444',
    textAlign: 'center',
    fontWeight: '400',
  },

  otpsubText: {
    fontSize: 14,
    marginBottom: 50,
    marginTop: 10,
    color: '#444',
    textAlign: 'center',
    fontWeight: '400',
  },

  input: {
    borderWidth: 1,
    marginBottom: 30,
    width: 300,
    padding: 12,
    borderRadius: 10,
    borderColor: '#ccc',
  },

  otpInput: {
    width: 300,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 30,
    fontSize: 18,
  },

  loginButton: {
    backgroundColor: '#2253e7',
    padding: 12,
    paddingHorizontal: 120,
    borderRadius: 20,
    alignItems: 'center',
  },

  loginButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },

  accountContainer: {
    flexDirection: 'row',
    marginTop: 25,
  },

  accountText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },

  accountLink: {
    color: '#0b5ed7',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 5,
  },

  bottomText: {
    textAlign: 'center',
    marginTop: 28,
    color: '#6b7280',
    fontSize: 13,
  },

});
