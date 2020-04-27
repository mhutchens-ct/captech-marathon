import { Component, OnInit } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import { LineLayout, LinePaint, Map, SymbolLayout } from 'mapbox-gl';
import * as turf from '@turf/turf';
import { ActivityService } from '../services/activity.service';
import { CapTechOfficeCoord } from '../models/capTechOfficeCoord';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit {
  /** CapTech Offices */
  captechOffices: CapTechOfficeCoord = new CapTechOfficeCoord();

  map: Map; // mapbox-gl reference
  line;
  point;

  // styling for progress line drawn, used in html
  linePaint: LinePaint = {
    'line-color': '#888',
    'line-width': 4
  };
  lineLayout: LineLayout = {
    'line-cap': 'round',
    'line-join': 'bevel'
  };
  pointLayout: SymbolLayout = {
    'icon-image': 'pitch-15',
    'icon-rotate': ['get', 'bearing'],
    'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true
  };

  /**
   * Number of steps to use in the arc and animation, more steps means
   * a smoother arc and animation, but too many steps will result in a
   * low frame rate
   */
  steps = 500;
  /** Used to increment the value of the point measurement against the route. */
  counter = 0;

  private lineData;
  private tempCoords = [];
  progress = 0; // progress = timestamp - startTime

  constructor(private activityService: ActivityService) {
  }

  ngOnInit(): void {
  }

  setMap(event): void {
    this.map = event;

    this.map.fitBounds(new mapboxgl.LngLatBounds(this.captechOffices.den, this.captechOffices.phi), {padding: 50});

    this.drawOfficeMarkers();
    this.findDistance();
  }

  drawOfficeMarkers(): void {
    Object.keys(this.captechOffices).forEach(key => {
      const marker = document.createElement('div');
      marker.className = 'marker';
      marker.id = key;
      new mapboxgl.Marker(marker).setLngLat(this.captechOffices[key]).addTo(this.map);
    });
  }

  findDistance(type = 'totalMiles') {
    // provides the ability to change the starting point of the route to the selected office
    // todo add logic to allow for a selected 'starting' office
    const selectedRoute = this.captechOffices.getDefaultRoute();

    const totalOfficePerimeter = turf.length(selectedRoute, {units: 'miles'});
    this.activityService.getTotalMiles().subscribe(miles => {
      const milesTraveled = miles[type];

      const startOfRoute: [number, number] = selectedRoute.geometry.coordinates[0] as [number, number];
      // const coord: [number, number][] = [startOfRoute];

      // while (milesTraveled >= 0) {
      //   const traveledCoordinates = turf.lineSliceAlong(
      //     selectedRoute,
      //     0,
      //     milesTraveled > totalOfficePerimeter ? totalOfficePerimeter : milesTraveled,
      //     {units: 'miles'});
      //
      //   traveledCoordinates.geometry.coordinates.forEach(coordinate => coord.push([coordinate[0], coordinate[1]]));
      //   milesTraveled = milesTraveled - totalOfficePerimeter;
      // }

      // const lineDistance = turf.length(selectedRoute, {units: 'miles'});
      const newCoords = [];
      for (let i = 0; i < milesTraveled; i += milesTraveled / this.steps) {
        newCoords.push(turf.along(selectedRoute, i, {units: 'miles'}).geometry.coordinates);
      }

      this.lineData = newCoords;
      // this.lineTemp =

      // this.drawLine();
      this.animateLine();
      // this.drawRouteLeadPoint(route, startOfRoute);
    });
  }

  private animateLine() {
    // append new coordinates to the lineString
    this.tempCoords.push(this.lineData[this.progress]);

    // then update the map
    this.line = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: this.tempCoords
          }
        }]
    };

    // Request the next frame of the animation.
    if (this.progress < this.steps) {
      requestAnimationFrame(this.animateLine.bind(this));
    }
    this.progress += 1;
  }

  private drawRouteLeadPoint(geoJson, startOfRoute): void {
    this.point = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: startOfRoute
          }
        }
      ]
    };
    this.myAnimator();
  }

  private myAnimator() {
    const tempPoint = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            bearing: null
          },
          geometry: {
            type: 'Point',
            coordinates: null
          }
        }
      ]
    };

    // Update point geometry to a new position based on counter denoting
    // the index to access the arc.
    tempPoint.features[0].geometry.coordinates =
      this.line.features[0].geometry.coordinates[this.counter];

    // Calculate the bearing to ensure the icon is rotated to match the route arc
    // The bearing is calculate between the current point and the next point, except
    // at the end of the arc use the previous point and the current point
    tempPoint.features[0].properties.bearing = turf.bearing(
      turf.point(
        this.line.features[0].geometry.coordinates[
          this.counter >= this.steps ? this.counter - 1 : this.counter
          ]
      ),
      turf.point(
        this.line.features[0].geometry.coordinates[
          this.counter >= this.steps ? this.counter : this.counter + 1
          ]
      )
    );

    // Update the source with this new data.
    this.point = tempPoint;

    // Request the next frame of animation so long the end has not been reached.
    if (this.counter < this.steps) {
      requestAnimationFrame(this.myAnimator.bind(this));
    }

    this.counter += 1;
  }
}
