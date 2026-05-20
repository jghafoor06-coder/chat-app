  import React, { useEffect } from 'react';
  import { View, Text, StyleSheet, Image } from 'react-native';
  import auth from '@react-native-firebase/auth';

  const SplashScreen = ({ navigation }) => {
    useEffect(() => {
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
        <Image
          source={require('../assets/image.png')}
          style={styles.logo}
        />

        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Secure. Fast. Minimal</Text>
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