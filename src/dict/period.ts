export class Period {
  time: any; // lookbacks - keeping any for now since type is unclear

  constructor(lookbacks: any) {
    this.time = lookbacks;
  }
}
