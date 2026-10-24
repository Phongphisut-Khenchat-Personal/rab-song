# สำรองและย้ายฐาน

การเปลี่ยนแปลงนี้เพิ่มตารางและคอลัมน์ ไม่มีคำสั่งลบข้อมูลนักเรียนหรือรอบรถเดิม

Volume เดิมชื่อ `rabsong_pg` ถูกสร้างด้วย `postgres:16-alpine` และยังอยู่บนเครื่อง ไฟล์ Compose ปัจจุบันไม่ mount volume นั้น และไม่ลบมัน ฐานพัฒนาใหม่ใช้ volume `rabsong_postgis` กับอิมเมจ `postgis/postgis:16-3.4`

ก่อนเปลี่ยนฐานจริง ให้สำรองก่อนเสมอ

```powershell
docker exec rab-song-postgres-1 pg_dump -U rabsong -d rabsong -Fc -f /tmp/rabsong.dump
docker cp rab-song-postgres-1:/tmp/rabsong.dump .\backups\rabsong.dump
```

กู้คืนไปยังฐานว่าง

```powershell
docker cp .\backups\rabsong.dump rab-song-postgres-1:/tmp/rabsong.dump
docker exec rab-song-postgres-1 pg_restore -U rabsong -d rabsong --clean --if-exists /tmp/rabsong.dump
```

จากนั้นรัน `npx prisma migrate deploy` ห้ามรัน `npm run db:seed` กับฐานที่มีข้อมูลจริง

การย้อน migration นี้ทำได้โดยคืนจากไฟล์สำรอง PostgreSQL ไม่สามารถลบค่า enum ที่เพิ่มแล้วได้อย่างง่าย ๆ ส่วนตารางใหม่ถอนได้ถ้ายังไม่ต้องการ แต่ทางที่ปลอดภัยคือ restore ทั้งฐาน

คอลัมน์ `Place.geog` ใช้ PostGIS หากต้องย้ายไป PostgreSQL ที่ไม่มี PostGIS ให้ถอนคอลัมน์นั้นก่อน dump พิกัดตัวเลขยังอยู่ใน `latitude` และ `longitude`
