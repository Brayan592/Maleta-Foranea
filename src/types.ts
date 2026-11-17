export type LocalTimestamp = number | string | { __ms: number } | null;

export type GarmentCategory =
  | 'playeras'
  | 'pantalones'
  | 'chamarras'
  | 'calzado'
  | 'formal'
  | 'interior'
  | 'accesorios'
  | 'otros';

export type GarmentLocation = 'ciudad' | 'rancho' | 'maleta';
export type TargetLocation = 'ciudad' | 'rancho' | 'ninguno';
export type LaundryStatus = 'limpia' | 'por_lavar';
export type TripEndpoint = 'ciudad' | 'rancho';
export type TripStatus = 'planeando' | 'en_camino' | 'completado';

export const LIMITS = {
  NAME_MAX: 80,
  COLOR_MAX: 30,
  NOTES_MAX: 240,
  TRIP_TITLE_MAX: 100,
  CITY_RANCH_LABEL_MAX: 50,
  DISPLAY_NAME_MAX: 100,
  EMAIL_MAX: 200,
  TRAVEL_DATE_MAX: 30,
  TRIP_ITEMS_MAX: 100,
  QUANTITY_MIN: 1,
  QUANTITY_MAX: 99,
  SEASON_TITLE_MAX: 100,
  MONTH_LABEL_MAX: 40,
  TOP_MOVED_MAX: 10,
  SUMMARY_LINES_MAX: 50,
  SUMMARY_LINE_LEN: 160,
} as const;

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  cityLabel: string;
  ranchLabel: string;
  createdAt: LocalTimestamp;
  updatedAt: LocalTimestamp;
}

export interface Garment {
  id: string;
  ownerId: string;
  name: string;
  category: GarmentCategory;
  color: string;
  location: GarmentLocation;
  targetLocation: TargetLocation;
  laundryStatus: LaundryStatus;
  isEssential: boolean;
  notes: string;
  quantity: number;
  tripId: string;
  createdAt: LocalTimestamp;
  updatedAt: LocalTimestamp;
}

export interface Trip {
  id: string;
  ownerId: string;
  title: string;
  origin: TripEndpoint;
  destination: TripEndpoint;
  status: TripStatus;
  travelDate: string;
  itemIds: string[];
  packedIds: string[];
  notes: string;
  createdAt: LocalTimestamp;
  updatedAt: LocalTimestamp;
}

export interface Movement {
  id: string;
  ownerId: string;
  garmentId: string;
  garmentName: string;
  fromLocation: GarmentLocation;
  toLocation: GarmentLocation;
  tripTitle: string;
  createdAt: LocalTimestamp;
}

export interface SeasonReport {
  id: string;
  ownerId: string;
  title: string;
  monthKey: string;
  monthLabel: string;
  toCityCount: number;
  toRanchCount: number;
  totalMovements: number;
  completedTripsCount: number;
  citySnapshotCount: number;
  ranchSnapshotCount: number;
  bagSnapshotCount: number;
  topMovedNames: string[];
  movedSummaryLines: string[];
  notes: string;
  createdAt: LocalTimestamp;
}

export interface GarmentFormValues {
  name: string;
  category: GarmentCategory;
  color: string;
  location: GarmentLocation;
  targetLocation: TargetLocation;
  laundryStatus: LaundryStatus;
  isEssential: boolean;
  notes: string;
  quantity: number;
}

export const CATEGORY_OPTIONS: { value: GarmentCategory; label: string }[] = [
  { value: 'playeras', label: 'Playeras y camisas' },
  { value: 'pantalones', label: 'Pantalones y shorts' },
  { value: 'chamarras', label: 'Chamarras y sudaderas' },
  { value: 'calzado', label: 'Tenis, botas y calzado' },
  { value: 'formal', label: 'Ropa formal' },
  { value: 'interior', label: 'Interior y calcetines' },
  { value: 'accesorios', label: 'Gorras, cintos y mochilas' },
  { value: 'otros', label: 'Otros (toalla, pijama...)' },
];

export const CATEGORY_LABEL_MAP: Record<GarmentCategory, string> = {
  playeras: 'Playeras y camisas',
  pantalones: 'Pantalones',
  chamarras: 'Chamarras y sudaderas',
  calzado: 'Calzado',
  formal: 'Formal',
  interior: 'Interior y calcetines',
  accesorios: 'Accesorios',
  otros: 'Otros',
};

export const STARTER_GARMENTS: Omit<GarmentFormValues, 'targetLocation'>[] = [
  {
    name: 'Chamarra de mezclilla',
    category: 'chamarras',
    color: 'Azul índigo',
    location: 'ciudad',
    laundryStatus: 'limpia',
    isEssential: true,
    notes: 'Ideal para las mañanas frescas de clases',
    quantity: 1,
  },
  {
    name: 'Sudadera gris con gorro',
    category: 'chamarras',
    color: 'Gris jaspe',
    location: 'rancho',
    laundryStatus: 'limpia',
    isEssential: false,
    notes: 'Dejada en el clóset de la casa',
    quantity: 1,
  },
  {
    name: 'Playeras básicas de algodón',
    category: 'playeras',
    color: 'Blanco y negro',
    location: 'ciudad',
    laundryStatus: 'limpia',
    isEssential: false,
    notes: 'Para uso diario entre semana',
    quantity: 4,
  },
  {
    name: 'Camisa de cuadros franela',
    category: 'playeras',
    color: 'Verde pino',
    location: 'rancho',
    laundryStatus: 'limpia',
    isEssential: false,
    notes: 'Para fines de semana en el rancho',
    quantity: 1,
  },
  {
    name: 'Pantalón de mezclilla recto',
    category: 'pantalones',
    color: 'Azul oscuro',
    location: 'ciudad',
    laundryStatus: 'limpia',
    isEssential: true,
    notes: 'El que más uso para la uni',
    quantity: 2,
  },
  {
    name: 'Pants deportivo cómodo',
    category: 'pantalones',
    color: 'Negro',
    location: 'rancho',
    laundryStatus: 'por_lavar',
    isEssential: false,
    notes: 'Para andar cómodo en casa',
    quantity: 1,
  },
  {
    name: 'Tenis blancos urbanos',
    category: 'calzado',
    color: 'Blanco',
    location: 'ciudad',
    laundryStatus: 'limpia',
    isEssential: true,
    notes: 'Uso diario en la ciudad',
    quantity: 1,
  },
  {
    name: 'Botas de trabajo / campo',
    category: 'calzado',
    color: 'Café',
    location: 'rancho',
    laundryStatus: 'limpia',
    isEssential: false,
    notes: 'Se quedan fijo en el rancho',
    quantity: 1,
  },
  {
    name: 'Camisa blanca de vestir',
    category: 'formal',
    color: 'Blanco',
    location: 'ciudad',
    laundryStatus: 'limpia',
    isEssential: true,
    notes: 'Para exposiciones o entrevistas',
    quantity: 1,
  },
  {
    name: 'Pares de calcetines',
    category: 'interior',
    color: 'Surtidos',
    location: 'ciudad',
    laundryStatus: 'por_lavar',
    isEssential: false,
    notes: 'Llevar a lavar el fin de semana',
    quantity: 6,
  },
  {
    name: 'Gorra negra',
    category: 'accesorios',
    color: 'Negro',
    location: 'rancho',
    laundryStatus: 'limpia',
    isEssential: true,
    notes: 'Se me olvidó la vez pasada',
    quantity: 1,
  },
  {
    name: 'Toalla de microfibra viaje',
    category: 'otros',
    color: 'Gris pizarra',
    location: 'ciudad',
    laundryStatus: 'limpia',
    isEssential: true,
    notes: 'No ocupa casi espacio en la maleta',
    quantity: 1,
  },
];
