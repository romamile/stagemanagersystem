import { proxiedUrlFor } from "../utils/media-url-utils";
import { isValidSceneUrl } from "../utils/scene-url-utils";
import React, { Component, useEffect } from "react";

class stgSysClass {
  constructor(hubChannel) {
    this.myUser = { name: "default", role: "guest", avatarURL: "none" };
    this.listCue = [];
    this.mapItem = {}; // NO ITEM CALLED "webcam_item_unique""
    this.listAnim = [];
    this.listMorph = [];
    this.hubChannel = hubChannel;

    this.indexStylus = 0;

    this.spokeMap;

		// regCheck
		this.reg = {};
		this.reg.interval = null;

  }

  init(_username) {

    fetch("https://tstwebui.glitch.me/dbTEST.json")
    //fetch(proxiedUrlFor("https://tstwebui.glitch.me/db.json"))
      .then(function(response) {
        return response.json();
      })
      .then(data => {

        console.log(data);
					// A] User initialisation

				if(data.listUser.filter(user => user.name == _username).length > 0) {
					let user = data.listUser.filter(user => user.name == _username)[0];

          this.myUser.name = user.name;
          this.myUser.role = user.role;
          if (user.avatar !== undefined)
						this.myUser.avatar = user.avatarURL;

          this.renderCueVR();

          window.APP.store.update({ profile: { displayName: this.myUser.name } });
          window.APP.store.state.activity.hasChangedName = true;
          if (this.myUser.avatarURL !== "none")
            window.APP.store.state.profile.avatarId = proxiedUrlFor(this.myUser.avatarURL);
        } else {
          console.log(_username + " is unkown in the database of users");
        }

        console.log(this.myUser);


				// B] List of cues initialisation
        this.listCue = data.listCue;
				console.log("unfiltered");
        console.log(this.listCue);

					// B.1] filtering on room
						// find name of current room
				let sublink = location.pathname.toString().split("/")[1];
				let nameRoom = null;
				if(data.listRoom.filter(room => room.sublink == sublink).length > 0) {
					nameRoom = data.listRoom.filter(room => room.sublink == sublink)[0].name;
				}
				console.log("sublink => " + sublink + ", nameRoom => " + nameRoom);
					
				this.listCue = this.listCue.filter(cue => cue.room == nameRoom);
				console.log("room filtered");
        console.log(this.listCue);

					// B.2] filtering on role/button
				this.listCue = this.listCue.filter(cue => cue.trigger.type != "button" || cue.role == this.myUser.role);
				console.log("role/button filtered");
        console.log(this.listCue);

					// B.3] Adding local variables to cues
				this.listCue = this.listCue.map(cue => {
					cue.trigger.played=false;
					cue.trigger.ended=false;
					return cue;
				});
				console.log("with added variable");
        console.log(this.listCue);
	

				console.log("final list of cue");
        console.log(this.listCue);

					// C] Launch regCheck
					// TODO, regcheck as callback when web browser want a new frame?
        let readyToCheck = setInterval(() => {

			    if(AFRAME.scenes[0].is("entered")) {
            clearInterval(readyToCheck);
				    setTimeout(() => {
                // C.1] Init
                // C.1.1] Creating spokeMap
	            this.spokeMap = AFRAME.scenes[0].sceneEl.object3D.children[12].children[0].children[0].children[0].children;
							console.log("SpokeMap");
							console.log(this.spokeMap);
	
								// C.2] Creation of list of morph
							this.initMorph()
							console.log("list of morph");
							console.log(this.listMorph);

                // C.2] reg
              this.reg.interval = setInterval(() => {this.regCheck(), 20});
            }, 1000); // not sure why the timeout
			    }
			    return;
        }, 100);



      })
      .catch(function(err) {
        console.log(err);
      });
  }

	initMorph() {

		this.listCue.forEach( _cue => {
			let morph = {}; // name, point of proximity, radius, rule of update, morphDictIndex

			// 1) Checking if object exist
			let refObj = this.spokeMap.filter( x => x.name == _cue.target.src)[0]
			if(typeof refObj === "undefined") {
				console.error("couldn't find a morphTarget with obj of name; " + _cue.target.src);
				return;	
			}

			// 2) Get position
			morph.position = new THREE.Vector3();
			refObj.children[0].children[0].children[0].getWorldPosition(morph.position)
			
			// 3) Check if have something to apply morph to
		
			let hasMorph = false;
			refObj.traverseVisible( (_obj) => {
				// 3.1) does it have morphtargets?
				if(typeof _obj.morphTargetDictionary === "undefined")
					return;

				// 3.2) does it have the right morphtarget?
				let indexMorph = _obj.morphTargetDictionary[_cue.action.morphName];
				if(typeof indexMorph === "undefined") {
				console.error("couldn't find a morphTarget of name: "+ _cue.action.morphName  +", with obj of name; " + _cue.target.src);
				console.log(_obj);
			
					return;
				}
				
				hasMorph = true;
				morph.obj = _obj;
				morph.index = indexMorph;
			});

			// 4) Keep needed info from cue
			morph.distMin = _cue.action.distanceMin;
			morph.distMax = _cue.action.distanceMax;

			if(hasMorph)
				this.listMorph.push(morph);

		});
  }

	regCheck() {

      // A] Update morphtargets
		this.listMorph.forEach( _morph => {
          this.updateMorphTarget(_morph)
		});

      // B] Check for triggers to play new cues
		this.listCue.forEach( _cue => {

			if(_cue.trigger.played)
				return;

			switch(_cue.trigger.type) {
			case "start":
				_cue.trigger.played = true;
				setTimeout(()=>this.playAction(_cue), _cue.trigger.delay);
				break;

			case "proximity":
				let selfPos = AFRAME.scenes[0].querySelector("#avatar-rig").object3D.position;
				let distance = selfPos.distanceTo( new THREE.Vector3(_cue.trigger.position.x, _cue.trigger.position.y, _cue.trigger.position.z) );
				console.log(distance)
				if(selfPos.distanceTo( new THREE.Vector3(_cue.trigger.position.x, _cue.trigger.position.y, _cue.trigger.position.z) ) < _cue.trigger.radius) {
					_cue.trigger.played = true;
					setTimeout(()=>this.playAction(_cue), _cue.trigger.delay);
				}
				break;

			case "endtrig":
				this.listCue.forEach( _cueRef => {
					if(_cueRef.name == _cue.trigger.name && _cueRef.ended) {
						_cue.trigger.played = true;
						setTimeout(()=>this.playAction(_cue), _cue.trigger.delay);
					}
				});
				break;
			}

		});

	}


  playNextCue() {
    // A] Play next cue
    this.playAction(this.listCue[this.indexStylus]);

    // B] Increment indexStylus
    this.indexStylus++;

    // C] Move graphical stylus
    document.getElementById("stylusCue").style.top = 111 + 33 * (this.indexStylus - 1) + "px";
    // C.1] if for the first time, display graphical stylus
    document.getElementById("stylusCue").style.display = "block";
  }

  playAction(_cue) {
    console.log("PLAYING TRIG: " + _cue.name);
    _cue.played = true;

    switch (_cue.action.type) {
      case "spawn_item":
        setTimeout(() => this.spawnItem(_cue), _cue.trigger.time);
        break;

      case "spawn_prop":
        setTimeout(() => this.spawnProp(_cue), _cue.trigger.time);
        break;

      case "move":
        setTimeout(() => this.moveItem(_cue), _cue.trigger.time);
        break;

      case "delete":
        setTimeout(() => this.delItem(_cue.target.src), _cue.trigger.time);
        _cue.ended = true;
        break;

      case "change_scene":
        setTimeout(() => this.changeSceneTo(_cue.action.link), _cue.trigger.time);
        break;

      case "jump_to_waypoint":
        setTimeout(() => this.jumpToWaypoint(_cue.action.anchor), _cue.trigger.time);
        break;

      case "change_avatar":
        setTimeout(() => this.changeAvatar(_cue.action.link), _cue.trigger.time);
        break;

      case "call_method_from_object":
        setTimeout(
          () => this.callMethodFromObject(_cue.action.object_name, _cue.action.function_name, _cue.action._cue),
          _cue.trigger.time
        );
        break;
    }
  }

  // Functionalities ( Triggers / Behavior)

  // B.1) Changing scene
  async changeSceneTo(_link) {
    if (await isValidSceneUrl(_link)) {
      let err = this.hubChannel.updateScene(_link);
      if (err === "unauthorized") {
        alert("Valid scene link, but you're not authorised to change scene");
      }
    } else {
      alert("Invalid scene link");
    }
  }

  changeAvatar(_link) {
    const store = window.APP.store;
    store.update({ profile: { avatarId: _link } }, null, "profile");
    AFRAME.scenes[0].emit("avatar_updated");
  }

  // B.2) Changing waypoint
  jumpToWaypoint(_link) {
    let anchorLink = _link;
    let newUrl = document.location.href;
    newUrl = newUrl.split("#")[0];
    document.location.hash = anchorLink;
  }

  // B.3) Adding a props
  spawnProp(_cue) {
    // TODO: need to call "spawnItem" from this function

    if (typeof this.mapItem[_cue.name] != undefined && this.mapItem[_cue.name] != null) {
      return;
    }

    var el = document.createElement("a-entity");
    AFRAME.scenes[0].appendChild(el);
    el.setAttribute("media-loader", { src: _cue.target.src, resolve: true });
    el.setAttribute("networked", { template: "#interactable-media" });

    this.mapItem[_cue.name] = el;
    this.mapItem[_cue.name].listAnim = [];

    // Setting the props in front of the user, and facing it
    var selfEl = AFRAME.scenes[0].querySelector("#avatar-rig");
    var povCam = selfEl.querySelector("#avatar-pov-node");
    var dir = povCam.object3D.getWorldDirection();
    el.object3D.position.copy(selfEl.object3D.position);
    el.object3D.position.y += 1.3;
    el.object3D.position.x += -dir.x;
    el.object3D.position.z += -dir.z;
    el.object3D.rotation.set(_cue.action.rotation.x, _cue.action.rotation.y, _cue.action.rotation.z);
    el.object3D.scale.set(_cue.action.scale.x, _cue.action.scale.y, _cue.action.scale.z);

    return el;
  }

  spawnItem(_cue) {
    // A] Webcam share
    if (_cue.target.type == "webcam") {
      // A.1) Launch the request to spawn the share camera
      AFRAME.scenes[0].emit("action_share_camera");

      // A.2) Regularly check for the camera to be create
      // TODO: should have a failsafe if no camera is instantiated
      let mapItem = this.mapItem;
      window.timerIDcamGet = setInterval(function() {
        if (mapItem["webcam_item_unique"] === null || mapItem["webcam_item_unique"] == undefined) {
          // A.1.1) Check if there are streams, and if they are mine
          let listVidElt = AFRAME.scenes[0].querySelectorAll("[media-video]");
          let myVids = [];
          for (let e of listVidElt) {
            if (
              typeof e.attributes["body-helper"] !== "undefined" && // has the attribute
              e.attributes["body-helper"].nodeValue === "" && // seems to be case for personal streams (redontant?)
              typeof e.components["media-video"] !== "undefined" && // has the attribute
              e.components["media-video"].data.src.includes("client")
            ) {
              // seems even more specific to personal streams
              myVids.push(e);
            }
          }

          if (myVids.length < 1) return;

          // A.3) Camera has been initialised (and found...)
          mapItem["webcam_item_unique"] = myVids[myVids.length - 1];
          mapItem["webcam_item_unique"].listAnim = [];

          // A.4) Applying transform, ownership and pinning

          mapItem["webcam_item_unique"].object3D.matrixAutoUpdate = true;
          // Get ownership of element
          NAF.utils.takeOwnership("webcam_item_unique");

          // Apply transform
          mapItem["webcam_item_unique"].object3D.position.set(_cue.action.position.x, _cue.action.position.y, _cue.action.position.z);
          mapItem["webcam_item_unique"].object3D.rotation.set(_cue.action.rotation.x, _cue.action.rotation.y, _cue.action.rotation.z);
          mapItem["webcam_item_unique"].object3D.scale.set(
            _cue.action.scale.x,
            _cue.action.scale.y,
            _cue.action.scale.z
          );

          // Pin the element (No touchy!
          mapItem["webcam_item_unique"].setAttribute("pinnable", { pinned: true });

          clearInterval(window.timerIDcamGet);
        }
      }, 500);

      return;
    }

    // B] Classic 3D objects
    let el = document.createElement("a-entity");
    el.setAttribute("networked", { template: "#interactable-media" });
    AFRAME.scenes[0].appendChild(el);
    this.mapItem[_cue.name] = el;
    this.mapItem[_cue.name].listAnim = [];

    el.setAttribute("media-loader", { src: _cue.target.src, resolve: true });

    if (_cue.action.position == undefined) {
      // TEMPORARY, until we find a common design
      el.object3D.position.set(
        _cue.action.listTransform[0].position.x,
        _cue.action.listTransform[0].position.y,
        _cue.action.listTransform[0].position.z
      );
      el.object3D.rotation.set(
        _cue.action.listTransform[0].rotation.x,
        _cue.action.listTransform[0].rotation.y,
        _cue.action.listTransform[0].rotation.z
      );
      el.object3D.scale.set(
        _cue.action.listTransform[0].scale.x,
        _cue.action.listTransform[0].scale.y,
        _cue.action.listTransform[0].scale.z
      );
    } else {
      el.object3D.position.set(_cue.action.position.x, _cue.action.position.y, _cue.action.position.z);
      el.object3D.rotation.set(_cue.action.rotation.x, _cue.action.rotation.y, _cue.action.rotation.z);
      el.object3D.scale.set(_cue.action.scale.x, _cue.action.scale.y, _cue.action.scale.z);
    }

    switch (_cue.target.type) {
      case "glb":
        break;
      case "image":
        break;
      case "audio_video":
        let initEnded_audio = setInterval(() => {
          // INIT aspect, once the video element has been created;

          if (typeof el.components["media-video"] === "undefined") {
            return;
          }
          if (typeof el.components["media-video"].video === "undefined") {
            return;
          }

          updateAudio(el.components["media-video"], _cue);
          el.components["media-video"].video.loop = false;

          clearInterval(initEnded_audio);
        }, 100);

        let initEnded_endtrig = setInterval(() => {
          if (typeof el.components["media-video"] === "undefined") {
            return;
          }
          if (typeof el.components["media-video"].video === "undefined") {
            return;
          }

          // Endtrig aspect
          if (el.components["media-video"].video.ended) {
            //console.log("ENDED TRIG: " + _cue.name);
            //el.object3D.position.y = 9999999; // TODO: do we went to delete the video each time?
            //this.mapItem[_cue.name] = null;
            _cue.trigger.ended = true;

            clearInterval(initEnded_endtrig);
          }
        }, 500);

        // Play / Pause => in another code if needed

        break;
    }
  }

  // B.4) Deleting an Item
  delItem(_name) {
    console.log("DELETING => " + _name);
    if (this.mapItem[_name] != undefined) {
      this.mapItem[_name].object3D.matrixAutoUpdate = true;
      this.mapItem[_name].object3D.position.y = 9999999;
      if (this.mapItem[_name].listAnim !== undefined) {
        this.mapItem[_name].listAnim.forEach(elt => elt.pause());
      }
      //fix for testing
      try {
        AFRAME.scenes[0].removeChild(this.mapItem[_name]);
      } catch (err) {
        console.log("item already gone", err);
      }
      this.mapItem[_name] = null;
    }
  }

  // B.5) Moving an Item
  moveItem(_cue) {
    let myObj = this.mapItem[_cue.target.src].object3D;
    this.mapItem[_cue.target.src].object3D.matrixAutoUpdate = true;

    //anim.reverse()
    let animPos = AFRAME.ANIME.default.timeline({
      targets: myObj.position,
      loop: _cue.action.loop,
      autoplay: true,
      easing: "easeInOutSine",
      duration: _cue.action.duration
    });
    animPos.add(_cue.action.pos);
    animPos.play();

    let animRot = AFRAME.ANIME.default.timeline({
      targets: myObj.rotation,
      loop: _cue.action.loop,
      autoplay: true,
      easing: "easeInOutSine",
      duration: _cue.action.duration
    });
    animRot.add(_cue.action.rot);
    animRot.play();

    let animScale = AFRAME.ANIME.default.timeline({
      targets: myObj.scale,
      loop: _cue.action.loop,
      autoplay: true,
      easing: "easeInOutSine",
      duration: _cue.action.duration
    });
    animScale.add(_cue.action.scale);
    animScale.play();

    this.mapItem[_cue.target.src].listAnim.push(animPos);
    this.mapItem[_cue.target.src].listAnim.push(animRot);
    this.mapItem[_cue.target.src].listAnim.push(animScale);
  }

  // B.7) Update Audio
  updateAudio(_component, _cue) {
    if (typeof _cue.action.volume !== "undefined") {
      //el.setAttribute("media-video", "volume", THREE.Math.clamp(_cue.action.volume, 0, 1));
      _component.volume = THREE.Math.clamp(_cue.action.volume, 0, 1);
      _component.updateVolumeLabel();
    }

    if (typeof _cue.action.distanceModel !== "undefined") _component.audio.setDistanceModel(_cue.action.distanceModel);

    if (typeof _cue.action.rolloffFactor !== "undefined") _component.audio.setRolloffFactor(_cue.action.rolloffFactor);

    if (typeof _cue.action.refDistance !== "undefined") _component.audio.setRefDistance(_cue.action.refDistance);

    if (typeof _cue.action.maxDistance !== "undefined") _component.audio.setMaxDistance(_cue.action.maxDistance);

    if (typeof _cue.action.coneInnerAngle !== "undefined")
      _component.audio.panner.coneInnerAngle = _cue.action.coneInnerAngle;

    if (typeof _cue.action.coneOuterAngle !== "undefined")
      _component.audio.panner.coneOuterAngle = _cue.action.coneOuterAngle;

    if (typeof _cue.action.coneOuterGain !== "undefined")
      _component.audio.panner.coneOuterGain = _cue.action.coneOuterGain;
  }

  // B.8) Call Global function from personal code (or not!)
  callGlobalFunction(_functionName, _parameter) {
    window[_functionName](_parameter);
  }

  // B.9) Call Global function from personal code (or not!)
  callMethodFromObject(_objectName, _functionName, _parameter) {
    window[_objectName][_functionName](_parameter);
  }


  updateMorphTarget(_morph) {
   
    // 1) Caluclate value from distance
    let myPos = AFRAME.scenes[0].querySelector("#avatar-rig").object3D.position;
		let dist = myPos.distanceTo(_morph.position);
    let val = THREE.MathUtils.clamp( THREE.MathUtils.mapLinear ( dist, _morph.distMin, _morph.distMax, 0, 1 ), 0, 1)

    // 2) Applying to correct target
		_morph.obj.morphTargetInfluences[_morph.index] = val;

  }

  applyTransformToItem(_tr, _cue) {
    let myObj = this.mapItem[_cue.target.src].object3D;
    this.mapItem[_cue.target.src].object3D.matrixAutoUpdate = true;

    switch (_tr.type) {
      case "teleport":
        el.object3D.position.set(_cue.action.position.x, _cue.action.position.y, _cue.action.position.z);
        el.object3D.rotation.set(_cue.action.rotation.x, _cue.action.rotation.y, _cue.action.rotation.z);
        el.object3D.scale.set(_cue.action.scale.x, _cue.action.scale.y, _cue.action.scale.z);
        break;

      case "animation":
        break;
    }
  }

  // C) Graphics

  // C.1) Buttons interfaces for the cues
  renderCueUI() {
    const qs = new URLSearchParams(location.search);
    let exp = qs.has("experimental");
    let iCueTop = 2.2; // for the offset....
    let offsetY = 33;
    return (
      <div style={{ pointerEvents: "auto", userSelect: "none", left: "20px", position: "absolute", top: "50px" }}>
        {this.myUser.role != "guest" && (
          <>
            <div
              id="stylusCue"
              style={{
                position: "absolute",
                top: "111px",
                color: "white",
                display: "none",
                padding: "2px",
                margin: "0px",
                left: "-21px"
              }}
            >
              ⯈
            </div>
            <h2 className="divCue nameCue" style={{ top: "68px", padding: "4px" }}>
              {this.myUser.name}
              <p
                className="buttonCue"
                style={{ display: exp ? "block" : "none", right: "-50px", position: "relative", padding: "5px" }}
                onClick={() => this.playNextCue()}
              >
                ▷
              </p>
            </h2>
          </>
        )}
        {this.listCue.map(cue => {
          //if (this.myUser.role != cue.role) return;
          if (cue.trigger.type != "button") return;

          switch (cue.action.type) {
            case "item_management":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p className="nameCue">{cue.name}</p>
                  <div className="listLgCue">
                    <p
                      className="buttonCue"
                      style={{ float: "left" }}
                      onClick={() => setTimeout(() => this.spawnItem(cue), cue.trigger.time)}
                    >
                      Spawn
                    </p>
                    {cue.action.listTransform.map(tr => {
                      return (
                        <p
                          className="buttonCue"
                          style={{ float: "left" }}
                          onClick={() => setTimeout(() => this.applyTransformToItem(tr, cue), cue.trigger.time)}
                        >
                          {tr.name}
                        </p>
                      );
                    })}
                    <p
                      className="buttonCue"
                      style={{ float: "right" }}
                      onClick={() => setTimeout(() => this.delItem(cue.name), cue.trigger.time)}
                    >
                      Delete
                    </p>
                  </div>
                </div>
              );
              break;

            case "spawn_item":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p className="nameCue">{cue.name}</p>
                  <div className="listLgCue">
                    <p
                      className="buttonCue"
                      style={{ float: "left" }}
                      onClick={() => setTimeout(() => this.spawnItem(cue), cue.trigger.time)}
                    >
                      Spawn
                    </p>
                    <p
                      className="buttonCue"
                      style={{ float: "right" }}
                      onClick={() =>
                        setTimeout(
                          () => this.delItem(cue.target.type == "webcam" ? "webcam_item_unique" : cue.name),
                          cue.trigger.time
                        )
                      }
                    >
                      Delete
                    </p>
                  </div>
                </div>
              );
              break;

            case "spawn_prop":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p className="nameCue">{cue.name}</p>
                  <div className="listLgCue">
                    <p
                      className="buttonCue"
                      style={{ float: "left" }}
                      onClick={() => setTimeout(() => this.spawnProp(cue), cue.trigger.time)}
                    >
                      Spawn
                    </p>
                    <p
                      className="buttonCue"
                      style={{ float: "right" }}
                      onClick={() => setTimeout(() => this.delItem(cue.name), cue.trigger.time)}
                    >
                      Delete
                    </p>
                  </div>
                </div>
              );
              break;

            case "delete":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p className="nameCue">{cue.name}</p>
                  <div className="listLgCue">
                    <p
                      className="buttonCue"
                      style={{ float: "left" }}
                      onClick={() => setTimeout(() => this.delItem(cue.target.src), cue.trigger.time)}
                    >
                      Delete
                    </p>
                  </div>
                </div>
              );
              break;

            case "move":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p className="nameCue">{cue.name}</p>
                  <div className="listLgCue">
                    <p
                      className="buttonCue"
                      style={{ float: "left" }}
                      onClick={() => setTimeout(() => this.moveItem(cue), cue.trigger.time)}
                    >
                      Move
                    </p>
                  </div>
                </div>
              );
              break;

            case "jump_to_waypoint":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p className="nameCue">{cue.name}</p>
                  <div className="listLgCue">
                    <p
                      className="buttonCue"
                      onClick={() => setTimeout(() => this.jumpToWaypoint(cue.action.anchor), cue.trigger.time)}
                    >
                      To Waypoint
                    </p>
                  </div>
                </div>
              );
              break;

            case "change_scene":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p className="nameCue">{cue.name}</p>
                  <div className="listLgCue">
                    <p
                      className="buttonCue"
                      onClick={() => setTimeout(() => this.changeSceneTo(cue.action.link), cue.trigger.time)}
                    >
                      Chg Scene
                    </p>
                  </div>
                </div>
              );
              break;

            case "change_avatar":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p className="nameCue">{cue.name}</p>
                  <div className="listLgCue">
                    <p
                      className="buttonCue"
                      onClick={() => setTimeout(() => this.changeAvatar(cue.action.link), cue.trigger.time)}
                    >
                      Chg Avatar
                    </p>
                  </div>
                </div>
              );
              break;

            case "call_global_function":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p
                    className="buttonCue"
                    onClick={() => setTimeout(() => this.callGlobalFunction(cue.action.function_name), cue.trigger.time)}
                  >
                    {cue.name}
                  </p>
                </div>
              );
              break;

            case "call_method_from_object":
              iCueTop++;
              return (
                <div className="divCue" style={{ top: iCueTop * offsetY + "px" }} key={cue.role + cue.name}>
                  <p
                    className="buttonCue"
                    onClick={() =>
                      setTimeout(
                        () =>
                          this.callMethodFromObject(cue.action.object_name, cue.action.function_name, cue.action._cue),
                        cue.trigger.time
                      )
                    }
                  >
                    {cue.name}
                  </p>
                </div>
              );
              break;
          }
        })}
      </div>
    );
  }

  // VR User Interface

  addButt(_posX, _posY, _txt, _func) {
    let vrHUD = AFRAME.scenes[0].querySelector("a-entity[in-world-hud]");

    let newButt = document.createElement("a-entity");
    vrHUD.appendChild(newButt);

    newButt.setAttribute("is-remote-hover-target", true);
    newButt.setAttribute("class", "hud");
    newButt.setAttribute("position", "" + _posX + " " + _posY + " 0.001");

    // text
    //newButt.setAttribute("geometry", "primitive: plane; width: auto; height: auto");
    //newButt.setAttribute("material", "color: #333");

    newButt.setAttribute("backgroundColor", "#1da1f2");
    newButt.setAttribute("backgroundHoverColor", "#2db1ff");

    if (_func != null) {
      newButt.setAttribute("tags", "singleActionButton:true");
      newButt.object3D.addEventListener("interact", _func);
      newButt.setAttribute("text", "color: yellow; align: left; value:" + _txt + ";");
    } else {
      newButt.setAttribute("text", "color: white; align: left; value:" + _txt + ";");
    }
  }

  renderCueVR() {
    let iCueTop = 0;
    let offsetY = -0.07,
      offsetX = 0.6,
      ofX = -0.1,
      ofY = -0.17;

    // Name
    let vrHUD = AFRAME.scenes[0].querySelector("a-entity[in-world-hud]");

    let nameHUD = document.createElement("a-entity");
    nameHUD.setAttribute("text", "value: " + this.myUser.name);
    vrHUD.appendChild(nameHUD);
    nameHUD.setAttribute("class", "hud");
    nameHUD.object3D.position.set(ofX, ofY, 0.001);

    this.listCue.map(cue => {
      if (this.myUser.role != cue.role) return;

      switch (cue.action.type) {
        case "item_management":
          break;

        case "spawn_item":
          iCueTop++;
          this.addButt(ofX, ofY + offsetY * iCueTop, cue.name, null);
          this.addButt(ofX + offsetX, ofY + offsetY * iCueTop, "Spawn", () => {
            setTimeout(() => this.spawnItem(cue), cue.trigger.time);
          });
          this.addButt(ofX + offsetX + 0.15, ofY + offsetY * iCueTop, "Delete", () => {
            setTimeout(
              () => this.delItem(cue.target.type == "webcam" ? "webcam_item_unique" : cue.name),
              cue.trigger.time
            );
          });
          break;
        case "spawn_prop":
          iCueTop++;
          this.addButt(ofX, ofY + offsetY * iCueTop, cue.name, null);
          this.addButt(ofX + offsetX, ofY + offsetY * iCueTop, "Spawn", () => {
            setTimeout(() => this.spawnProp(cue), cue.trigger.time);
          });
          this.addButt(ofX + offsetX + 0.15, ofY + offsetY * iCueTop, "Delete", () => {
            setTimeout(
              () => this.delItem(cue.target.type == "webcam" ? "webcam_item_unique" : cue.name),
              cue.trigger.time
            );
          });
          break;

        case "delete":
          iCueTop++;
          this.addButt(ofX, ofY + offsetY * iCueTop, cue.name, null);
          this.addButt(ofX + offsetX, ofY + offsetY * iCueTop, "Delete", () => {
            setTimeout(() => this.delItem(cue.target.src), cue.trigger.time);
          });
          break;

        case "move":
          iCueTop++;
          this.addButt(ofX, ofY + offsetY * iCueTop, cue.name, null);
          this.addButt(ofX + offsetX, ofY + offsetY * iCueTop, "To Waypoint", () => {
            setTimeout(() => this.moveItem(cue), cue.trigger.time);
          });
          break;

        case "jump_to_waypoint":
          iCueTop++;
          this.addButt(ofX, ofY + offsetY * iCueTop, cue.name, null);
          this.addButt(ofX + offsetX, ofY + offsetY * iCueTop, "To Waypoint", () => {
            setTimeout(() => this.jumpToWaypoint(cue.action.anchor), cue.trigger.time);
          });
          break;

        case "change_scene":
          iCueTop++;
          this.addButt(ofX, ofY + offsetY * iCueTop, cue.name, null);
          this.addButt(ofX + offsetX, ofY + offsetY * iCueTop, "To Waypoint", () => {
            setTimeout(() => this.changeSceneTo(cue.action.link), cue.trigger.time);
          });
          break;

        case "change_avatar":
          iCueTop++;
          this.addButt(ofX, ofY + offsetY * iCueTop, cue.name, null);
          this.addButt(ofX + offsetX, ofY + offsetY * iCueTop, "To Waypoint", () => {
            setTimeout(() => this.changeAvatar(cue.action.link), cue.trigger.time);
          });
          break;

        case "call_global_function":
          iCueTop++;
          this.addButt(ofX, ofY + offsetY * iCueTop, cue.name, null);
          this.addButt(ofX + offsetX, ofY + offsetY * iCueTop, "Call function", () => {
            setTimeout(() => this.callGlobalFunction(cue.action.function_name), cue.trigger.time);
          });
          break;

        case "call_method_from_object":
          iCueTop++;
          this.addButt(ofX, ofY + offsetY * iCueTop, cue.name, null);
          this.addButt(ofX + offsetX, ofY + offsetY * iCueTop, "Call function", () => {
            setTimeout(
              () => this.callMethodFromObject(cue.action.object_name, cue.action.function_name),
              cue.trigger.time
            );
          });
          break;
      }
    });
  }
}

export default stgSysClass;
