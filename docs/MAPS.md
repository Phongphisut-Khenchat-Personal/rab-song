# แผนที่และเส้นทาง

ตรวจใบอนุญาตจากแหล่งทางการก่อนนำมาใช้ในรอบนี้

| ชิ้น | เวอร์ชันที่ตรวจ | ใบอนุญาต | แหล่ง |
| --- | --- | --- | --- |
| Leaflet | 1.9.4 | BSD 2-Clause | https://github.com/Leaflet/Leaflet/blob/v1.9.4/LICENSE |
| OSRM | 5.27.1 | BSD | https://github.com/Project-OSRM/osrm-backend/blob/v5.27.1/LICENSE.TXT |
| VROOM | 1.14.0 | BSD 2-Clause | https://github.com/VROOM-Project/vroom/blob/v1.14.0/LICENSE |
| PostGIS | 3.4 | GPL-2.0-or-later | https://github.com/postgis/postgis/blob/stable-3.4/LICENSE.TXT |
| ข้อมูล OpenStreetMap | ตามชุดข้อมูลที่โฮสต์เอง | ODbL | https://www.openstreetmap.org/copyright |

OSRM และ VROOM ไม่ได้ถูกติดตั้งในแอป แอปเรียกผ่าน HTTP เฉพาะเมื่อตั้ง `OSRM_BASE_URL` หรือ `VROOM_BASE_URL` คำขอมีเฉพาะพิกัด ไม่มีชื่อเด็ก เบอร์โทร หรือที่อยู่เต็ม

ตัวค้นหาที่อยู่ส่งเฉพาะข้อความที่ผู้ใช้พิมพ์ไปที่ `GEOCODER_BASE_URL` ไม่แนบรหัสนักเรียน

แผนที่ในหน้าจอแสดงเมื่อมีทั้ง `NEXT_PUBLIC_MAP_TILE_URL` และ `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` แอปไม่ได้ชี้ไปที่เซิร์ฟเวอร์ไทล์สาธารณะเป็นค่าเริ่มต้น เพราะเซิร์ฟเวอร์เหล่านั้นไม่ได้อนุญาตให้ใช้เชิงพาณิชย์แบบไม่จำกัด

ถ้าเซิร์ฟเวอร์เส้นทางตอบไม่ได้ ระบบบอกว่าคำนวณไม่ได้ และไม่ใส่เวลาหรือระยะทางเอง ลำดับจุดอัตโนมัติเป็นคำแนะนำ เจ้าของต้องตรวจก่อนเผยแพร่

พิกัดไม่ใช่การตรวจความปลอดภัยของถนน ทางเข้า หรือจุดจอด สถานะจุดเปลี่ยนได้เมื่อมีคนยืนยันเท่านั้น
