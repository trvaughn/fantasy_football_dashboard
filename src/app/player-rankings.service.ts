import { Injectable } from '@angular/core';
import { Http } from '@angular/http';

import { ByeWeekService } from './bye-week.service';
import { CURRENT_SELECTED_PLAYERS, CURRENT_REMAINING_PLAYERS } from './data.model';

import 'rxjs/add/operator/toPromise';

@Injectable()
export class PlayerRankingsService {
  
  private nflEditorRankingsURL = "http://api.fantasy.nfl.com/v1/players/editordraftranks?format=json&count=100";


  //creating variables for optimization purposes so don't have to keep filtering and slicing everytime
  overallResults: {}[] = []; 
  selectedPlayers: {}[] = [];
  selectedPlayersIndiv: {}[] = []; //to track where to add back

  private resultMappings: {} = {};
  private byes: {} = {}

  constructor(private http: Http, private byeWeekService: ByeWeekService) {
    
    this.byeWeekService.search(); //ensure this variable is populated
    this.byes = this.byeWeekService.getByeWeeks();

    //***Check if player lists are cached and if so re-instate */
    var json = JSON.parse(sessionStorage.getItem(CURRENT_SELECTED_PLAYERS));
    if(json != null){
      json.forEach(item => {
        this.selectedPlayers.push(item);
      });
    }

    var remainingJson = JSON.parse(sessionStorage.getItem(CURRENT_REMAINING_PLAYERS));
    if(remainingJson != null){
      this.overallResults = [];
      remainingJson.forEach(item => {
        this.overallResults.push(item);
      });
    }

  }

  search(): Promise<any>{
    //if already cached then use cached list, otherwise grab a new list
    if (sessionStorage.getItem(CURRENT_REMAINING_PLAYERS) == null){
      //grabbing new list
      this.overallResults = [];
      //return 1000 player rankings
      let promise = new Promise((resolve, reject) => {
        for (var i = 0; i < 2000; i+=100){
          //creating REST call
          this.http.get(this.nflEditorRankingsURL + "&offset=" + i).toPromise().then(
              res => { // Success     
                  var jsonResult = res.json()["players"]; //grab array of search results from json
                  jsonResult.forEach(result => {
                      //add bye week
                      result["bye"] = this.byes[result["teamAbbr"]];
                      
                      //create copy of list
                      var newMap = {};
                      for (var i in result)
                       newMap[i] = result[i];

                      //load overall rankings
                      this.overallResults.push(newMap);
                  });
                  resolve();
                }
          )};
      }).then(() => [this.addIndivRank()]); //load positional lists)
      
      return promise;
    }

    return null;
  }
  
  getResults(position: string, mode: string = "normal"): any[]{
    if(mode == "normal"){
      //this.getMappings(); //ensure result lists are up-to-date
      //console.log("filter value: " + filterValue);
      console.log("position: " + position);
      if(position == "OVERALL"){
        return this.overallResults.slice(0,50);
      }
      else{
        var filteredList = this.overallResults.filter(function(result){
          return result["position"] == position;
        });
  
        return filteredList.slice(0,50);
      }
      
      //return this.resultMappings[filterValue].slice(0,200);
    }

    //for future expansion if want to do idp
    else{

    }

    return [];

  }

  getSelected(){
    return this.selectedPlayers;
  }


  selectPlayer(playerRank: number, position: string){
    var overallIndex= 0;
    var offset = 0;

    //safety check in case the player rank is larger than the remaining list 
    //(example: rank = 300 but list is only 200 players left)
    var startIndex = playerRank > this.overallResults.length - 1 ? this.overallResults.length - 1 : playerRank;

    var player = this.overallResults[startIndex - offset];

    //find player from overall list
    this.overallResults.forEach(player => {
      if(parseInt(player["rank"]) == playerRank){
        overallIndex = this.overallResults.indexOf(player);
      }
    }); 

    //add player as selected and remove from overall list
    player = this.overallResults.splice(overallIndex, 1)[0];
    player["taken"] = this.selectedPlayers.length + 1 + ""; //because pushing
    //console.log(player);
    this.selectedPlayers.push(player);

    sessionStorage.setItem(CURRENT_SELECTED_PLAYERS, JSON.stringify(this.selectedPlayers));
    sessionStorage.setItem(CURRENT_REMAINING_PLAYERS, JSON.stringify(this.overallResults));

  }



  clearSelected(){
      this.selectedPlayers = [];
  }

  unselectPlayer(playerRank: number, position: string){
    var selectedIndex= 0;
    var offset = 0;
    var overallIndex = 0;
    var startIndex = this.selectedPlayers.length - 1;
    var player = this.selectedPlayers[startIndex - offset];
    var taken = 0;
  
    this.selectedPlayers.forEach(p => {
      if(parseInt(p["rank"]) == playerRank){
        player = p;
        selectedIndex = this.selectedPlayers.indexOf(p);
      }
      
    })

    //check if edge case (first ranked on remaining list)
    if(parseInt(this.overallResults[0]["rank"]) < playerRank){
      //get the insertion index back into overall list 
      this.overallResults.forEach(overallResult =>{
        //compare to 0 so only overwrite it once
        if(parseInt(overallResult["rank"]) > playerRank && overallIndex == 0){
          overallIndex = this.overallResults.indexOf(overallResult);
        }
      });
    }

    //reset because hasn't been taken
    player = this.selectedPlayers.splice(selectedIndex, 1);
    player = player[0];
    player["taken"] = ""; 

    //re-rank taken
    this.selectedPlayers.forEach(player => {
      player["taken"] = ++taken + "";
    });


    //add player
    this.overallResults.splice(overallIndex, 0, player);

    //cache results
    sessionStorage.setItem(CURRENT_SELECTED_PLAYERS, JSON.stringify(this.selectedPlayers));
    sessionStorage.setItem(CURRENT_REMAINING_PLAYERS, JSON.stringify(this.overallResults));

  }

  private addIndivRank(){
    var qbCount = 0; var rbCount = 0; var wrCount = 0;
    var teCount = 0; var defCount = 0; var kCount = 0;

    this.overallResults.forEach(result => {
      result["taken"] = ""; //add field so all data is consistent
      if(result["position"] == "QB" && result["rank"] > 0){
        result["indivRank"] = ++qbCount + "";
      }
      else if(result["position"] == "RB" && result["rank"] > 0){
        result["indivRank"] = ++rbCount + "";
      }
      else if(result["position"] == "WR" && result["rank"] > 0){
        result["indivRank"] = ++wrCount + "";
      }

      
      else if(result["position"] == "TE" && result["rank"] > 0){
        result["indivRank"] = ++teCount + "";
      }
      else if(result["position"] == "DEF" && result["rank"] > 0){
        result["indivRank"] = ++defCount + "";
      }

      else if(result["position"] == "K" && result["rank"] > 0){
        result["indivRank"] = ++kCount + "";
      }   
    });

  }
}

