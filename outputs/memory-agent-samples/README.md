# Rossi Telecom Complete Memory Agent Fixture

This directory contains one complete customer chat case for testing `记忆整理`.

## Customer

- Contact: Marco Rossi
- Company: Rossi Telecom SRL
- Country: Italy
- City: Milan
- Role: Purchasing Manager
- Website: https://www.rossitelecom.it
- Email: marco.rossi@rossitelecom.it
- Phone: +39 347 555 0198
- Delivery address: Via Torino 18, 20123 Milan, Italy

## Files

- `text/rossi_telecom_complete_chat.txt`: full pasted-text transcript.
- `json/rossi_telecom_complete_accio_export.json`: Accio-compatible JSON export for the same conversation.
- `images/rossi_telecom_complete_chat_part_01.png` through `images/rossi_telecom_complete_chat_part_05.png`: continuous screenshot-style chat images for the same conversation. Upload all five together to test screenshot transcription, batching and merge order.

## Expected Memory Agent Extraction

- Create one customer profile for Rossi Telecom SRL / Marco Rossi.
- Identify inquiry: 500 pcs S25 Ultra magnetic rugged case, clear back + black frame, retail box, logo/EAN sticker, Italian warranty card.
- Identify commercial terms: sample US$35; negotiated 500 pcs DDP Milan total US$1,925; bulk payment 30% deposit and 70% before shipment; next 1,000 pcs price expectation.
- Identify delivery: sample ships June 23 by DHL tracking 1234567890, ETA June 27; bulk schedule July 2 shipment and July 7-9 Milan arrival if deposit/artwork confirmed June 24.
- Identify follow-up: wait for sample feedback June 27-28, collect logo/EAN/warranty text, prepare final bulk PI.
- `missing_fields` should be empty for customer/contact/company/country because those fields are visible in the chat.

## Image Paths

- `/Users/eee/Desktop/Sentura-Platform-ecommerce/outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_01.png`
- `/Users/eee/Desktop/Sentura-Platform-ecommerce/outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_02.png`
- `/Users/eee/Desktop/Sentura-Platform-ecommerce/outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_03.png`
- `/Users/eee/Desktop/Sentura-Platform-ecommerce/outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_04.png`
- `/Users/eee/Desktop/Sentura-Platform-ecommerce/outputs/memory-agent-samples/images/rossi_telecom_complete_chat_part_05.png`
