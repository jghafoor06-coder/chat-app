  import React, { useEffect, useRef } from 'react';
  import { View, Text, StyleSheet, Animated } from 'react-native';
  import auth from '@react-native-firebase/auth';

  const SplashScreen = ({ navigation }) => {
    const logoAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.spring(logoAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();

      const subscriber = auth().onAuthStateChanged(user => {
        if (user) {
          navigation.replace('Tabnavigation');
        } else {
          navigation.replace('authstack');
        }
      });

      return subscriber;
    }, [navigation]);

    return (
      <View style={styles.container}>
        <Animated.Image
          source={require('../assets/image.png')}
          style={[
            styles.logo,
            {
              opacity: logoAnim,
              transform: [{
                scale: logoAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1],
                }),
              }],
            },
          ]}
        />

        <View>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Secure. Fast. Minimal</Text>
        </View>
      </View>
    );
  };

  export default SplashScreen;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
    },
    logo: {
      width: 120,
      height: 120,
      marginBottom: 20,
    },
    title: {
      fontSize: 30,
      fontWeight: 'bold',
      color: '#0b5ed7',
    },
    subtitle: {
      fontSize: 15,
      color: '#b1afaf',
      marginTop: 5,
    },
  });