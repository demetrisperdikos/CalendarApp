import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, TextInput, Image, StyleSheet, Dimensions, StatusBar, ScrollView, Button, Keyboard, Switch } from 'react-native';
import { Calendar } from 'react-native-calendars';
import Modal from 'react-native-modal';
import * as ImagePicker from 'expo-image-picker';
import RNPickerSelect from 'react-native-picker-select';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(false);
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState({});
  const [images, setImages] = useState({});
  const [color, setColor] = useState('white');
  const [searchQuery, setSearchQuery] = useState('');
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [prevUpcomingEvents, setPrevUpcomingEvents] = useState([]); // New state variable to store the previous upcomingEvents
  const [recurrence, setRecurrence] = useState('none');

  const [textModalVisible, setTextModalVisible] = useState(false);
  const [textModalContent, setTextModalContent] = useState('');

  const [weatherData, setWeatherData] = useState(null);
  const [weatherModalVisible, setWeatherModalVisible] = useState(false);

  const storeData = async (key, value) => {
    try {
      const jsonValue = JSON.stringify(value)
      await AsyncStorage.setItem(key, jsonValue)
    } catch (e) {
      console.log(e);
    }
  }

  const loadData = async (key) => {
    try {
      const jsonValue = await AsyncStorage.getItem(key)
      return jsonValue != null ? JSON.parse(jsonValue) : {};
    } catch(e) {
      console.log(e);
    }
  }
  
  const triggerNotification = async () => {
    const upcomingEvent = upcomingEvents.find(event => event.notify && !event.notificationScheduled); // Find the first event where notify is true and notificationScheduled is false
    if (upcomingEvent) {
      let trigger = new Date(upcomingEvent.date);

      trigger.setDate(trigger.getDate() - 1); // Set the trigger to be 24 hours before the event
      trigger.setHours(9); // Set the time you want the notification to be triggered
      trigger.setMinutes(0);
      trigger.setSeconds(0);
  
      // Check if the event is less than 24 hours away
      if (trigger.getTime() <= Date.now()) {
        // If the event is less than 24 hours away, set the trigger time to be the current time plus 1 second
        trigger = new Date(Date.now() + 1000);
      }
  
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Upcoming Event: ',
          body: ` ${upcomingEvent.event}`,
          data: { date: upcomingEvent.date },
        },
        trigger,
      });
  
      // Mark the event as having a notification scheduled
      setNotes(prev => {
        const newNotes = {...prev};
        newNotes[upcomingEvent.date].notificationScheduled = true;
        return newNotes;
      });
    }
  };

  useEffect(() => {
    if (JSON.stringify(upcomingEvents) !== JSON.stringify(prevUpcomingEvents)) { // Check if upcomingEvents has actually changed
      triggerNotification();
      setPrevUpcomingEvents(upcomingEvents); // Update prevUpcomingEvents
    }
  }, [upcomingEvents]);

  useEffect(() => {
    (async () => {
      const loadedNotes = await loadData('@notes');
      const loadedImages = await loadData('@images');
      setNotes(loadedNotes);
      setImages(loadedImages);
    })();
  }, []);

  useEffect(() => {
    storeData('@notes', notes);
  }, [notes]);

  useEffect(() => {
    storeData('@images', images);
  }, [images]);

  const DayComponent = ({date, state}) => {
    const note = notes[date.dateString];
    const image = images[date.dateString];
    const backgroundColor = note ? note.color : 'white';
    return (
      <TouchableOpacity onPress={() => {
        console.log('selected day', date);
        setSelectedDay(date.dateString);
        setModalVisible(true);
      }}>
        <View style={[styles.dayContainer, {backgroundColor}]}>
          <Text style={styles.dayText}>{date.day}</Text>
          {note && note.text && <Text style={styles.noteText}>{note.text.slice(0, 20)}.</Text>}
          {image && <Image source={{uri: image.uri}} style={note && note.text ? styles.image : styles.imageLarge} resizeMode="contain" />}
        </View>
      </TouchableOpacity>
    );
  };
  
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    console.log(result);

    if (!result.cancelled) {
      setImages({...images, [selectedDay]: {uri: result.uri, color}});
    }
  };

  const deleteNoteOrImage = () => {
    setNotes(prev => {
      const newNotes = {...prev};
      delete newNotes[selectedDay];
      return newNotes;
    });
    setImages(prev => {
      const newImages = {...prev};
      delete newImages[selectedDay];
      return newImages;
    });
    setModalVisible(false);
  };

  const deleteRecurringEvent = () => {
    const recurringEventText = notes[selectedDay].text;
    setNotes(prev => {
      const newNotes = {...prev};
      for (let date in newNotes) {
        if (newNotes[date].text === recurringEventText) {
          delete newNotes[date];
        }
      }
      return newNotes;
    });
    setModalVisible(false);
  };

  useEffect(() => {
    if (selectedDay) {
      const note = notes[selectedDay];
      setNoteText(note ? note.text : '');
      setColor(note ? note.color : 'white');
      setRecurrence(note ? note.recurrence : 'none');
      setIsNotifyEnabled(note ? note.notify : false);
    }
  }, [selectedDay]);

  const search = () => {
    const formattedSearchQuery = moment(searchQuery, 'MM/DD/YYYY').format('YYYY-MM-DD');
    if (moment(formattedSearchQuery, 'YYYY-MM-DD', true).isValid()) {
      setSelectedDay(formattedSearchQuery);
      setModalVisible(true);
    } else {
      let found = false;
      for (let date in notes) {
        if (notes[date].text.includes(searchQuery)) {
          setSelectedDay(date);
          setModalVisible(true);
          found = true;
          break;
        }
      }
      if (!found) {
        alert('No events found for this date or event');
      }
    }
  };
  
  useEffect(() => {
    const today = moment().format('YYYY-MM-DD');
    const events = Object.keys(notes)
      .filter(date => moment(date, 'YYYY-MM-DD').isSameOrAfter(today))
      .map(date => ({date, event: notes[date].text, notify: notes[date].notify}))
      .sort((a, b) => moment(a.date, 'YYYY-MM-DD').diff(moment(b.date, 'YYYY-MM-DD')));
    setUpcomingEvents(events);
  }, [notes]);

  const saveTextModalContent = () => {
    console.log(textModalContent);
    setTextModalVisible(false);
    Keyboard.dismiss();
  };
  
  const fetchWeatherData = async () => {
    try {
      const response = await axios.get('https://ipinfo.io/json');
      const location = response.data.loc.split(',');
      const lat = location[0];
      const lon = location[1];
      const weatherResponse = await axios.get(`//myAPIkey`);
      const noonForecasts = weatherResponse.data.list.filter(forecast => {
        const forecastTime = new Date(forecast.dt * 1000);
        return forecastTime.getUTCHours() === 12;
        
      });
      setWeatherData({...weatherResponse.data, list: noonForecasts});
      setWeatherModalVisible(true);
    } catch (error) {
      console.error(error);
      
    }
  };

  const saveNote = () => {
    let newNotes = {...notes, [selectedDay]: {text: noteText, color, recurrence, notify: isNotifyEnabled}};
    
    let date = moment(selectedDay);
    switch (recurrence) {
      case 'daily':
        for (let i = 0; i < 30; i++) {
          date = date.add(1, 'days');
          newNotes[date.format('YYYY-MM-DD')] = {text: noteText, color, recurrence, notify: isNotifyEnabled};
        }
        break;
      case 'weekly':
        for (let i = 0; i < 4; i++) {
          date = date.add(1, 'weeks');
          newNotes[date.format('YYYY-MM-DD')] = {text: noteText, color, recurrence, notify: isNotifyEnabled};
        }
        break;
      case 'monthly':
        for (let i = 0; i < 12; i++) {
          date = date.add(1, 'months');
          newNotes[date.format('YYYY-MM-DD')] = {text: noteText, color, recurrence, notify: isNotifyEnabled};
        }
        break;
      case 'yearly':
        for (let i = 0; i < 5; i++) {
          date = date.add(1, 'years');
          newNotes[date.format('YYYY-MM-DD')] = {text: noteText, color, recurrence, notify: isNotifyEnabled};
        }
        break;
      default:
        break;
    }

    setNotes(newNotes);
    setModalVisible(false);
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          onChangeText={setSearchQuery}
          value={searchQuery}
          placeholder="Search by date (MM/DD/YYYY) or event"
        />
        <TouchableOpacity style={styles.searchButton} onPress={search}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>
      <Calendar
        style={styles.calendar}
        dayComponent={({date, state}) => <DayComponent date={date} state={state} />}
        onDayPress={(day) => {
          console.log('selected day', day);
          setSelectedDay(day.dateString);
          setModalVisible(true);
        }}
        theme={{
          'stylesheet.calendar.main': {
            week: {
              marginTop: 5,
              marginBottom: 5,
              flexDirection: 'row',
              justifyContent: 'space-around'
            },
            dayContainer: {
              flex: 1,
              height: 60  // Adjust this value to increase the height of each day cell
            }
          }
        }}
      />
      <View style={styles.bottomContainer}>
        <View style={styles.upcomingEventsContainer}>
          <Text style={styles.upcomingEventsTitle}>Upcoming Events</Text>
          <ScrollView>
            {upcomingEvents.map(({date, event}, index) => (
              <View key={index} style={styles.event}>
                <Text style={styles.eventDate}>{moment(date, 'YYYY-MM-DD').format('MM/DD/YY')}:</Text>
                <Text style={styles.eventText}>{event}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
        <View style={styles.editorButtonContainer}>
          <TouchableOpacity style={styles.button} onPress={() => setTextModalVisible(true)}>
            <Text style={styles.buttonText}>Open Text Editor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={fetchWeatherData}>
            <Text style={styles.buttonText}>Show Weather Forecast</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={darkMode}>
            <Text style={styles.buttonText}>Dark Mode</Text>
          </TouchableOpacity>
        </View>
        
      </View>


      
      <Modal isVisible={isModalVisible} onBackdropPress={() => {setModalVisible(false); setNoteText('');}}>
  <View style={styles.modal}>
    <Text style={styles.modalTitle}>Date: {moment(selectedDay, 'YYYY-MM-DD').format('MM/DD/YY')}</Text>
    {images[selectedDay] && <Image source={{uri: images[selectedDay].uri}} style={styles.modalImage} />}
    <TextInput style={styles.input} value={noteText} onChangeText={setNoteText} />
    <RNPickerSelect
      onValueChange={(value) => setColor(value)}
      items={[
          { label: 'White', value: 'white' },
          { label: 'Red', value: '#fa7a7a' },
          { label: 'Green', value: 'green' },
          { label: 'Blue', value: '#7acffa' },
          { label: 'Yellow', value: 'yellow' },
          { label: 'Purple', value: '#bf78f5' },
          { label: 'Orange', value: 'orange' },
          { label: 'Pink', value: 'pink' },
      ]}
      style={pickerSelectStyles}
      placeholder={{label: 'Choose Category', value: null}}
    />
    <RNPickerSelect
      onValueChange={(value) => setRecurrence(value)}
      items={[
          { label: 'None', value: 'none' },
          { label: 'Daily', value: 'daily' },
          { label: 'Weekly', value: 'weekly' },
          { label: 'Monthly', value: 'monthly' },
          { label: 'Yearly', value: 'yearly' },
      ]}
      style={pickerSelectStyles}
      placeholder={{label: 'Choose Recurrence', value: null}}
    />
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      <Text style={{ marginRight: 10 }}>Enable notifications:</Text>
      <Switch
        trackColor={{ false: "#767577", true: "#81b0ff" }}
        thumbColor={isNotifyEnabled ? "#f5dd4b" : "#f4f3f4"}
        ios_backgroundColor="#3e3e3e"
        onValueChange={setIsNotifyEnabled}
        value={isNotifyEnabled}
      />
    </View>
    <TouchableOpacity style={styles.button} onPress={saveNote}>
      <Text style={styles.buttonText}>{notes[selectedDay] ? 'Save Note' : 'Add Note'}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.button} onPress={pickImage}>
      <Text style={styles.buttonText}>Add Image</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.button} onPress={deleteNoteOrImage}>
      <Text style={styles.buttonText}>Delete Note/Image</Text>
    </TouchableOpacity>
    {notes[selectedDay] && notes[selectedDay].recurrence !== 'none' && (
      <TouchableOpacity style={styles.button} onPress={deleteRecurringEvent}>
        <Text style={styles.buttonText}>Delete Recurring Event</Text>
      </TouchableOpacity>
    )}
  </View>
</Modal>

<Modal isVisible={textModalVisible} onBackdropPress={() => setTextModalVisible(false)}>
  <View style={styles.textModal}>
    <TouchableOpacity style={styles.button} onPress={saveTextModalContent}>
      <Text style={styles.buttonText}>Save</Text>
    </TouchableOpacity>
    <TextInput
      style={styles.textModalInput}
      multiline
      numberOfLines={4}
      onChangeText={setTextModalContent}
      value={textModalContent}
    />
  </View>
</Modal>

      <Modal isVisible={weatherModalVisible} onBackdropPress={() => setWeatherModalVisible(false)}>
    <View style={styles.modal}>
      {weatherData && (
        <>
          <Text style={styles.modalTitle}>Weather Forecast for {weatherData.city.name}</Text>
          {weatherData.list.slice(0, 5).map((forecast, index) => (
            <View key={index} style={styles.weatherForecast}>
              <Text style={styles.weatherForecastDate}>{moment(forecast.dt_txt).format('MM/DD/YY hh:mm A')}</Text>
              <Text style={styles.weatherForecastTemp}>{Math.round((forecast.main.temp - 273.15) * 9/5 + 32)}°F</Text>
              <Text style={styles.weatherForecastDescription}>{forecast.weather[0].description}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: StatusBar.currentHeight,
    padding: 10,
  },
  searchBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderColor: '#000',
    borderWidth: 1,
    marginRight: 10,
    paddingLeft: 10,
    borderRadius: 10,
  },
  searchButton: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: 40,
    borderRadius: 10,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  calendar: {
    marginBottom: 20,
  },
  dayContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
  },
  dayText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteText: {
    fontSize: 12,
    color: '#000',
  },
  image: {
    width: '100%',
    height: '30%',
    resizeMode: 'contain',
  },
  imageLarge: {
    width: '100%',
    height: '60%',
    resizeMode: 'contain',
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  upcomingEventsContainer: {
    flex: 1,
    marginRight: 10,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    borderRadius: 10,
  },
  editorButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upcomingEventsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  event: {
    marginBottom: 10,
  },
  eventDate: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventText: {
    fontSize: 14,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalImage: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  input: {
    height: 80,
    borderColor: '#000',
    borderWidth: 1,
    marginBottom: 10,
    paddingLeft: 10,
    borderRadius: 10,
  },
  button: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    height: 40,
    marginBottom: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  textModal: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
  },
  textModalInput: {
    height: 450,
    borderColor: '#000',
    borderWidth: 1,
    marginBottom: 10,
    paddingLeft: 10,
    borderRadius: 10,
  },
  weatherForecast: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  weatherForecastDate: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  weatherForecastTemp: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold', 
    marginBottom: 5,
  },
  weatherForecastDescription: {
    fontSize: 14,
    color: 'black',
  },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 4,
    backgroundColor: 'black',
    marginBottom: 10,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    paddingRight: 30, // to ensure the text is never behind the icon
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: 'white',
    borderRadius: 8,
    backgroundColor: 'black',
    marginBottom: 10,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    paddingRight: 30, // to ensure the text is never behind the icon
  },
});
