/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';
import BeautifulSoup from 'beautiful-soup-js'
import { Tooltip as ReactTooltip } from "react-tooltip";

import { X, Edit, Zap, ArrowUp, ArrowDown, Mic, Download,Settings, VolumeX, XSquare, Volume, Volume1, Volume2 } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';
import { Map } from '../components/Map';

import './ConsolePage.scss';
import { isJsxOpeningLikeElement } from 'typescript';
import { json } from 'stream/consumers';
import welcome from '../images/welcome-sign.png'

const EXTENSION_ID = 'eokgnmokjnaphdknelmcimkbbchkfmcf';

const client_info = `Client Information:
Andy (45 years old), annual income = $60,000, 401k = $125,000
Value of home = $250,000, mortgage = $65,000
No consumer debt
Monthly expenses = $3,500
Savings Account = $35,500
12 month CD = $25,000
i-bonds = $30,000
Roth IRA = $2,000 contributed in 2025
High Yield money market = $50,000
Goals:
1. Live debt free
2. Modest vacation = $5,000 annually
3. Leave a legacy to the church when both pass away
 
Inherited portfolio
KHC = shares
JNJ = 400 shares
LM = 350 shares
MMM = 250 shares
NIO = 1,000 shares
PG = 400 shares
QCOM = 250 shares
RSM 100 shares
STT = 500 shares
T = 500 shares
 
Upcoming meetings
1/14/25 - Annual review in office with Andy
2/14/25 - Bring in documents to the office to support Roth IRA conversion`;

/**
 * Type for result from get_weather() function call
 */
interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  temperature?: {
    value: number;
    units: string;
  };
  wind_speed?: {
    value: number;
    units: string;
  };
}

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

let greeting:string = 'Hi Friday'
let playAudio:boolean = true;

export function ConsolePage() {
  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
      prompt('OpenAI API Key') ||
      '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [src,setSrc] = useState('')
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>({
    lat: 35.9132,
    lng: -79.0558,
  });
  const [marker, setMarker] = useState<Coordinates | null>(null);

  const[initialized,setInitialized] = useState<boolean>(false);

  const[showSplash, setShowSplash] = useState<boolean>(true);
  const[showSplashMini, setShowSplashMini] = useState<boolean>(false);
  const[showMap, setShowMap] = useState<boolean>(false);
  const[showChat, setShowChat] = useState<boolean>(false);
 
  let port:any;

  /**
   * Demo actions
   */

  const toolUseDemo = () => {
    setShowSplash(false);
    setShowMap(true);
    setShowChat(true);
    connectConversation();
  }

    /**
   * Demo actions
   */

  const virtualAssistant = () => {
      setShowSplash(false);
      setShowMap(false);
      setShowSplashMini(true);
      setShowChat(true);
      connectConversation();
    }

  const coach = () => {
      setShowSplash(false);
      setShowSplashMini(true);
      setShowMap(false);
      setShowChat(true);

      greeting = `I want you to help me with a role-play coaching session. You will play the
      role of a client who needs help staring their financial planning journey. Pick a random persona
      for your client. I will play the role of the financial advisor. We will discuss your needs and I'll provide financial advice as we
      go. When I indicate that our conversation is at an end, you will rate the advice I provided on
      a scale of 1 (worst) to 10 (best) and you will provide a succinct summary of how I could have
      improved on the advice I gave. You will start the interaction by introducing yourself.`

      connectConversation();
    }


    const listen = () => {
      playAudio = false;
      setShowSplash(false);
      setShowSplashMini(true);
      setShowMap(false);
      setShowChat(true);

      greeting = `Hi. As we talk I want to you call functions whenever you think they might provide
      useful information based on what I'm saying. Don't wait for me to explicitly ask for something.
      Instead, use your judgement to decide when to use a function to help me.`

      connectConversation();
    }


  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  /**
   * When you click the API key
   */
  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  /**
   * Connect to conversation:
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnecting(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    // Connect to realtime API
    await client.connect();
    setShowSplash(false);
    setShowChat(true);
    setShowMap(true);
    setIsConnecting(false);
    setIsConnected(true);
    client.sendUserMessageContent([{
        type: `input_text`,
        text: greeting
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    
    // Reset greeting
    greeting = 'Hi!'
    playAudio = true;

    setIsConnecting(false);
    setIsConnected(false);
    setShowSplash(true);
    setShowChat(false);
    setShowMap(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setCoords({
      lat: 35.9132,
      lng: -79.0558,
    });
    setMarker(null);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();

    setShowSplash(true);
    setShowSplashMini(false);
    setShowMap(false);
    setShowChat(false);

  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      const filtered = items.filter(item => item.id === trackId);
      if(filtered.length > 0) {
        filtered[0].formatted.text = filtered[0].formatted?.transcript;
        setItems((items) => items);
      }
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };

  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;

    // Set instructions
    client.updateSession({ instructions: instructions });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });
    client.updateSession({ voice: 'shimmer'});

    client.addTool(
      {
        name: 'knowledge_search',
        description:
          `Finds answers to questions related to financial and tax planning`,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The question expressed in the form of a short web search query'
            }
          },
          required: ['query'],
        },
      },
      async ({ query }: { [key: string]: any }) => {
        let url = "http://localhost:8080/knowledge_search";
        console.log('Sending request to url: ' + url);
        const result = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: query
          })
        });
        const json = await result.json();
        console.log('Got response' + JSON.stringify(json));
        return json.results;
      }
    );

    client.addTool(
      {
        name: 'get_weather',
        description:
          'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
        parameters: {
          type: 'object',
          properties: {
            lat: {
              type: 'number',
              description: 'Latitude',
            },
            lng: {
              type: 'number',
              description: 'Longitude',
            },
            location: {
              type: 'string',
              description: 'Name of the location',
            },
          },
          required: ['lat', 'lng', 'location'],
        },
      },
      async ({ lat, lng, location }: { [key: string]: any }) => {
        setMarker({ lat, lng, location });
        setCoords({ lat, lng, location });
        const result = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`
        );
        const json = await result.json();
        const temperature = {
          value: json.current.temperature_2m as number,
          units: json.current_units.temperature_2m as string,
        };
        const wind_speed = {
          value: json.current.wind_speed_10m as number,
          units: json.current_units.wind_speed_10m as string,
        };
        setMarker({ lat, lng, location, temperature, wind_speed });
        return json;
      }
    );

    client.addTool(
      {
        name: 'show_client_summary',
        description:
          `Shows the summary information for a client`,
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name of the client'
            }
          },
          required: ['name'],
        },
      },
      async ({ name }: { [key: string]: any }) => {
        chrome.runtime.sendMessage(EXTENSION_ID, 
          {
            action: 'client-summary',
            payload: {}
          }
        );
        return `Displaying client summary information`;
      }
    );

    client.addTool(
      {
        name: 'navigate_to_url',
        description:
          `Navigates the user's web browser to a provided URL`,
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL to navigate to'
            }
          },
          required: ['url'],
        },
      },
      async ({ url }: { [key: string]: any }) => {
        chrome.runtime.sendMessage(EXTENSION_ID, 
          {
            action: 'navigate',
            payload: {
              url: url,
              newTab: true
            }
          }
        );
        return `Navigated user's browser to ${url}`;
      }
    );

    client.addTool(
      {
        name: 'get_client_information',
        description:
          `Provides information to help answer questions the user has about a client, including upcoming meetings`,
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name of the client'
            }
          },
          required: ['name'],
        },
      },
      async ({ name }: { [key: string]: any }) => {
        return {
          information: client_info
        }
      }
    );

    client.addTool(
      {
        name: 'get_form_field_names',
        description:
          `Gets a list of all the field names on a form that the user is looking at`,
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Describe your request'
            }
          }
        },
      },
      async ({ description }: { [key: string]: any }) => {
        let response = await chrome.runtime.sendMessage(EXTENSION_ID, {action: 'get-field-names'});
        console.log(`Got repsonse: ${JSON.stringify(response)}`)
        return response;
      }
    );

    client.addTool(
      {
        name: 'set_form_field_value',
        description:
          `Sets the value of a field on the form that the user is looking at. Always call the get_form_field_names function before this one to validate that your choice of field name exists`,
        parameters: {
          type: 'object',
          properties: {
            fieldName: {
              type: 'string',
              description: 'The name of the field on the form'
            },
            fieldValue: {
              type: 'string',
              description: 'The value to set the field to'
            }
          },
          required: ['fieldName', 'fieldValue'],
        },
      },
      async ({ fieldName, fieldValue }: { [key: string]: any }) => {
        let response = await chrome.runtime.sendMessage(EXTENSION_ID, 
          {
            action: 'set-field-value',
            payload: {
              label: fieldName,
              value: fieldValue
            }
          }
        );
        console.log(`Got repsonse: ${JSON.stringify(response)}`)
        return {
          message:'Updated field value'
        };
      }
    );

    client.addTool(
      {
        name: 'get_web_page_text',
        description:
          `Gets the full text content from the current web page`,
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Describe your request'
            }
          }
        },
      },
      async ({ description }: { [key: string]: any }) => {
        let response = await chrome.runtime.sendMessage(EXTENSION_ID, 
          {
            action: 'get-page-content'
          }
        );
        console.log(`Got response: ${JSON.stringify(response)}`)
        let soup = new BeautifulSoup(response.content);
        let pageContent = soup.getText();
        console.log(`Extracted page text: ${pageContent}`);
        return {
          content: pageContent
        }
      }
    );

    client.addTool({
        name: 'create_client_note',
        description:
          `Creates a note for a named client`,
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The client name'
            },
            title: {
              type: 'string',
              description: 'The title of the note'
            },
            body: {
              type: 'string',
              description: 'The content of the note'
            }
          },
          required: ['name', 'title', 'body']
        },
      },
      async ({ name, title, body }: { [key: string]: any }) => {
        console.log('Navigating to new note screen')
        chrome.runtime.sendMessage(EXTENSION_ID, 
          {
            action: 'navigate',
            payload: {
              url: 'https://ej-agentforcewskhp-11-3.lightning.force.com/lightning/action/quick/Global.NewNote?objectApiName=Note&context=RECORD_DETAIL&recordId=001Kj00002UWMdoIAH&backgroundContext=%2Flightning%2Fr%2FAccount%2F001Kj00002UWMdoIAH%2Fview',
              newTab: false
            }
          }
        );
        // Sleep for 3 seconds
        console.log('Wait for screen to load')
        await new Promise(resolve => setTimeout(resolve, 3000));

        //Set the title of the note
        console.log('Set Title field')
        await chrome.runtime.sendMessage(EXTENSION_ID, 
          {
            action: 'set-field-value',
            payload: {
              label: 'Title',
              value: title
            }
          }
        );

        //Set the body of the note
        console.log('Set Body field');
        await chrome.runtime.sendMessage(EXTENSION_ID, 
          {
            action: 'set-field-value',
            payload: {
              label: 'Body',
              value: body
            }
          }
        );

        return {
          message: 'Done. Ask the user if it looks OK'
        }

      }
    );

    client.addTool({
      name: 'create_client_calendar_event',
      description:
        `Creates a calendar event for a named client`,
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The client name'
          },
          subject: {
            type: 'string',
            description: 'The subject for the calendar event',
            enum: ['Call','Email','Meeting','Send Letter/Quote','Other']
          },
          description: {
            type: 'string',
            description: 'The description for the calendar event'
          }
        },
        required: ['name', 'subject', 'description']
      },
    },
    async ({ name, subject, description }: { [key: string]: any }) => {
      console.log('Navigating to new event screen')
      chrome.runtime.sendMessage(EXTENSION_ID, 
        {
          action: 'navigate',
          payload: {
            url: 'https://ej-agentforcewskhp-11-3.lightning.force.com/lightning/action/quick/Global.NewEvent?objectApiName=Event&context=RECORD_DETAIL&recordId=001Kj00002UWMdoIAH&backgroundContext=%2Flightning%2Fr%2FAccount%2F001Kj00002UWMdoIAH%2Fview',
            newTab: false
          }
        }
      );
      // Sleep for 3 seconds
      console.log('Wait for screen to load')
      await new Promise(resolve => setTimeout(resolve, 3000));

      //Set the subject of the event
      console.log('Set Subject field')
      await chrome.runtime.sendMessage(EXTENSION_ID, 
        {
          action: 'set-field-value',
          payload: {
            label: 'Subject',
            value: subject
          }
        }
      );

      //Set the description of the event
      console.log('Set description field');
      await chrome.runtime.sendMessage(EXTENSION_ID, 
        {
          action: 'set-field-value',
          payload: {
            label: 'Description',
            value: description
          }
        }
      );

      return {
        message: 'Done. Ask the user if it looks OK'
      }
    });

    client.addTool(
      {
        name: 'take_picture_of_screen',
        description:
          'Takes a picture of the current web page and extracts the information you request from it',
        parameters: {
          type: 'object',
          properties: {
            request: {
              type: 'string',
              description: 'Any specific details you want to know about the screen',
            }
          },
          required: [],
        },
      },
      async ({ request }: { [key: string]: any }) => {
        let tabResponse = await chrome.runtime.sendMessage(EXTENSION_ID, {action: 'capture-screen'});
        const imageUrl = tabResponse.url;
        console.log(`Received response: ${JSON.stringify(imageUrl)}`);
        const result = await fetch(
          `https://api.openai.com/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('tmp::voice_api_key')}`
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: "Your role is to help a customer support agent dealing with a customer issue. The customer has shared a screen capture and your job is to provide a detailed description of the page that will help the customer support agent understand what the customer is looking at."
                },{
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: request || ''
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: imageUrl
                      }
                    }
                  ]
                }
              ]
            })
          }
        );
        const json = await result.json();
        const response = json.choices[0].message.content;
        return {
          description: response
        }
      }
    );

    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        const filtered = client.conversation.getItems().filter(item => item.id === trackId);
        if(filtered.length > 0) {
          filtered[0].formatted.text = filtered[0].formatted?.transcript;
        }
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        console.log(playAudio);
        if(playAudio) {
          wavStreamPlayer.add16BitPCM(delta.audio, item.id);
        }
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());
    
    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);

  const connect = () => {
    if(port) return;
    console.log('Initializing port connection');
    try {
      port = chrome.runtime.connect(EXTENSION_ID, {name: '' + Date.now()});
      console.log(JSON.stringify(port))
      port.onDisconnect.addListener(() => {
        port = null;
        connect();
      });
      port.onMessage.addListener((message:any) => {
        console.log(`Received message: ${JSON.stringify(message)}`);
      });
      console.log('Established port connection')
    } catch(err) {
      console.log(err);
    }
  }

  useEffect(() => {
    if(!initialized) {
      connect();
      setInitialized(true);
    }
  }, [initialized]);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-top-left">
          <Button
              label={''}
              data-tooltip-id="my-tooltip-1"
              disabled={false}
              iconPosition={'only'}
              icon={Edit}       
              buttonStyle={'flush'}
          />
          <Toggle
              defaultValue={'voice'}
              disabled={true}
              labels={['voice', 'text']}
              values={['voice', 'text']}
          />
          <ReactTooltip
            id="my-tooltip-1"
            place="bottom-end"
            content="New Chat"
            variant='dark'
          />
        </div>
        <div className='content-top-right'>
          <Button
            label={''}
            disabled={false}
            iconPosition={'only'}
            icon={Volume2}
            buttonStyle={'flush'}
          />
          <Button
            label={''}
            data-tooltip-id="my-tooltip-2"
            disabled={false}
            iconPosition={'only'}
            icon={Settings}
            buttonStyle={'flush'}
          />
            <ReactTooltip
            id="my-tooltip-2"
            place="bottom-start"
            content="Settings"
            variant='dark'
          />
      </div>
      </div>
      <div className="content-main">
        <div className="content-logs">

          { showSplash && (
            <div className="welcome">
              <div className="splash">
                <img src={welcome} width="335"></img>
              </div>
              <div className="banner">
                <div className="tagline">I'm Friday, your AI Assistant</div>
                <div className="tagText">Talk to me just like you'd talk to a 
                  real person. I can use the same tools and data that you can.
                  I can see your screen and operate your browser for you.
                  I'm ready to help!</div>
              </div>
              
            </div>
          )}

          { showSplashMini && (
            <div className="welcome">
              <div className="splash-mini"></div>
            </div>
          )}
      
          { showMap && (
            <div className="content-block map" hidden={true}>
              <div className="content-block-title bottom">
                {marker?.location || 'weather not yet retrieved'}
                {!!marker?.temperature && (
                  <>
                    <br />
                    🌡️ {marker.temperature.value} {marker.temperature.units}
                  </>
                )}
                {!!marker?.wind_speed && (
                  <>
                    {' '}
                    🍃 {marker.wind_speed.value} {marker.wind_speed.units}
                  </>
                )}
              </div>
              <div className="content-block-body full">
                {coords && (
                  <Map
                    center={[coords.lat, coords.lng]}
                    location={coords.location}
                
                  />
                )}
              </div>
            </div>
          )}


          {showChat && (
          <>
          { showMap && (
          <div className="content-block events">
            <div className="content-block-title">events</div>
            <div className="content-block-body" ref={eventsScrollRef}>
              {!realtimeEvents.length && `awaiting input...`}
              {realtimeEvents.map((realtimeEvent, i) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event };
                if (event.type === 'input_audio_buffer.append') {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === 'response.audio.delta') {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id}>
                    <div className="event-timestamp">
                      {formatTime(realtimeEvent.time)}
                    </div>
                    <div className="event-details">
                      <div
                        className="event-summary"
                        onClick={() => {
                          // toggle event details
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) {
                            delete expanded[id];
                          } else {
                            expanded[id] = true;
                          }
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${
                            event.type === 'error'
                              ? 'error'
                              : realtimeEvent.source
                          }`}
                        >
                          {realtimeEvent.source === 'client' ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )}
                          <span>
                            {event.type === 'error'
                              ? 'error!'
                              : realtimeEvent.source}
                          </span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">
                          {JSON.stringify(event, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
          <div className="content-block conversation">
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting input...`}
              {items.map((conversationItem, i) => {
                if(!playAudio && !(conversationItem.type == 'function_call' || conversationItem.type == 'function_call_output')) {
                  return;
                }
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ').replace('assistant', 'friday')}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                  '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </>
          )}
          <div className="visualization">
            <div className="visualization-entry client">
              <canvas ref={clientCanvasRef} />
            </div>
            <div className="visualization-entry server">
              <canvas ref={serverCanvasRef} />
            </div>
          </div>
        <div className="content-actions">
            <Toggle
              disabled={false}
              defaultValue={false}
              labels={['manual', 'auto']}
              values={['none', 'server_vad']}
              onChange={(_, value) => changeTurnEndType(value)}
            />
            {isConnected && canPushToTalk && (
              <Button
                label={''}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                icon={Mic}
                iconPosition='only'
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )}
            <Button
              label={isConnecting ? 'connecting' : isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'start' : 'start'}
              icon={isConnecting ? Zap : isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
