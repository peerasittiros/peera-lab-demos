'use client';

import type { Locale } from '@peera/i18n';
import { Button, Field, Input, Select, toast } from '@peera/ui';
import { useCallback, useState, type FormEvent } from 'react';
import { useStore } from '@/src/client-store/hooks';
import { actUpdateRoom } from '@/src/client-store/commands/property';
import { useRole } from '@/src/client-store/role';
import type { StoreState } from '@/src/client-store/store';
import { translator } from '@/src/i18n';
import { commandContext, messageFor } from './OwnerEdits';

/** The room and the types its building offers, read from the store. */
function viewOf(s: StoreState, roomId: string) {
  const room = s.data.room.find((r) => r.id === roomId) ?? null;
  const types = room
    ? s.data.room_type.filter((t) => t.buildingId === room.buildingId)
    : [];
  return { room, types };
}

/** Edits a room's number, floor, type, size and meter digit counts (SPEC §4 O3). Opens in place. */
export function RoomEditForm({
  locale,
  roomId,
}: {
  locale: Locale;
  roomId: string;
}) {
  const { m } = translator(locale);
  const p = m.ownerEdits;
  const role = useRole();
  const select = useCallback((s: StoreState) => viewOf(s, roomId), [roomId]);
  const { room, types } = useStore(select);
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [sizeSqm, setSizeSqm] = useState('');
  const [elecDigits, setElecDigits] = useState('');
  const [waterDigits, setWaterDigits] = useState('');

  if (!room) return null;

  const startEdit = () => {
    setNumber(room.number);
    setFloor(String(room.floor));
    setRoomTypeId(room.roomTypeId);
    setSizeSqm(room.sizeSqm === null ? '' : String(room.sizeSqm));
    setElecDigits(String(room.elecMeterDigits));
    setWaterDigits(String(room.waterMeterDigits));
    setEditing(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = actUpdateRoom(commandContext(role), {
      roomId: room.id,
      number,
      floor: Number(floor),
      roomTypeId,
      sizeSqm: sizeSqm.trim() === '' ? null : Number(sizeSqm),
      elecMeterDigits: Number(elecDigits),
      waterMeterDigits: Number(waterDigits),
    });
    toast({
      title: result.ok ? p.roomSaved : messageFor(m, result.error),
    });
    if (result.ok) setEditing(false);
  };

  if (!editing) {
    return (
      <Button
        type="button"
        variant="secondary"
        locale={locale}
        onClick={startEdit}
      >
        {p.editRoom}
      </Button>
    );
  }
  return (
    <form
      onSubmit={submit}
      lang={locale}
      className="flex flex-col gap-4 rounded-sm border border-line bg-surface-sunken p-4"
    >
      <Field label={p.roomNumber} locale={locale} required>
        <Input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          required
        />
      </Field>
      <Field label={p.floor} locale={locale} required>
        <Input
          type="number"
          min={-5}
          max={200}
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          required
        />
      </Field>
      <Field label={p.roomType} locale={locale} required>
        <Select
          locale={locale}
          value={roomTypeId}
          onValueChange={setRoomTypeId}
          options={types.map((t) => ({
            value: t.id,
            label: locale === 'th' ? t.nameTh : (t.nameEn ?? t.nameTh),
          }))}
        />
      </Field>
      <Field label={p.roomSize} locale={locale}>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={sizeSqm}
          onChange={(e) => setSizeSqm(e.target.value)}
        />
      </Field>
      <Field label={p.elecDigits} locale={locale} required>
        <Input
          type="number"
          min={3}
          max={8}
          value={elecDigits}
          onChange={(e) => setElecDigits(e.target.value)}
          required
        />
      </Field>
      <Field label={p.waterDigits} locale={locale} required>
        <Input
          type="number"
          min={3}
          max={8}
          value={waterDigits}
          onChange={(e) => setWaterDigits(e.target.value)}
          required
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" locale={locale}>
          {p.save}
        </Button>
        <Button
          type="button"
          variant="ghost"
          locale={locale}
          onClick={() => setEditing(false)}
        >
          {p.cancel}
        </Button>
      </div>
    </form>
  );
}
