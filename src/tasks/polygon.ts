export type Point={x:number;y:number};
export function pointInPolygon(point:Point,polygon:readonly Point[]):boolean{let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];const crosses=(a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x;if(crosses)inside=!inside;}return inside;}
