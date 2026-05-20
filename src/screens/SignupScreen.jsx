import React, {useState, useEffect} from 'react';
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
} from 'react-native';

import auth from '@react-native-firebase/auth';

const SignupScreen = ({navigation}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Auth Listener
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(user => {
      if (user) {
        console.log('User Logged In:', user.phoneNumber);
      }
    });

    return subscriber;
  }, []);

  // Send OTP
  const sendOTP = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter phone number');
      return;
    }

    // Number must contain country code
    if (!phoneNumber.startsWith('+')) {
      Alert.alert(
        'Invalid Number',
        'Use country code.\nExample: +923001234567',
      );
      return;
    }

    try {
      setLoading(true);

      const confirmation = await auth().signInWithPhoneNumber(
        phoneNumber.trim(),
      );

      setConfirm(confirmation);

    } catch (error) {
      console.log('SEND OTP ERROR:', error);

      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const confirmCode = async () => {
    if (!confirm) {
      Alert.alert('Error', 'Please request OTP first');
      return;
    }

    if (!code.trim()) {
      Alert.alert('Error', 'Please enter OTP');
      return;
    }

    if (code.trim().length !== 6) {
      Alert.alert('Error', 'OTP must be 6 digits');
      return;
    }

    try {
      setLoading(true);

      const userCredential = await confirm.confirm(code.trim());

      const user = userCredential.user;

      navigation.navigate('Username', {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
      });
    } catch (error) {
      console.log('VERIFY OTP ERROR:', error);

      Alert.alert(
        'Invalid OTP',
        'The OTP you entered is incorrect or expired.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {!confirm ? (
          <>
            <Image
              source={require('../assets/image.png')}
              style={styles.image}
            />

            <Text style={styles.heading}>Create Account</Text>

            <Text style={styles.subText}>
              Enter your mobile number to continue.
            </Text>

            <TextInput
              placeholder="+923001234567"
              placeholderTextColor="#bdbec0"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              style={styles.input}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={sendOTP}
              activeOpacity={0.8}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>

            <View style={styles.accountContainer}>
              <Text style={styles.accountText}>
                Already have an account?
              </Text>

              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}>
                <Text style={styles.accountLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Image
              source={require('../assets/image.png')}
              style={styles.image}
            />

            <Text style={styles.heading}>Enter OTP</Text>

            <Text style={styles.otpSubText}>
              Enter the OTP received via SMS to {'\n'}
              complete verification.
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
              style={styles.button}
              onPress={confirmCode}
              activeOpacity={0.8}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.buttonText}>Verify OTP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}>
              <Text style={styles.bottomText}>
                Already have an account?{' '}
                <Text style={styles.accountLink}>Login</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 20,
  },

  image: {
    height: 100,
    width: 100,
    resizeMode: 'contain',
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
    marginBottom: 50,
    color: '#444',
    textAlign: 'center',
  },

  otpSubText: {
    fontSize: 14,
    marginBottom: 50,
    marginTop: 10,
    color: '#444',
    textAlign: 'center',
  },

  input: {
    width: 300,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 30,
    fontSize: 15,
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

  button: {
    width: 300,
    backgroundColor: '#2253e7',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  accountContainer: {
    flexDirection: 'row',
    marginTop: 25,
  },

  accountText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
  },

  accountLink: {
    color: '#0b5ed7',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 5,
  },

  bottomText: {
    textAlign: 'center',
    marginTop: 28,
    color: '#6b7280',
    fontSize: 13,
  },
});