import { NONE, GLOBAL_ROTOR, GLOBAL_HINGE, LOCAL_ROTOR, LOCAL_HINGE, J_BALL, J_GLOBAL, J_LOCAL, END, START, MIN_DEGS, MAX_DEGS, MAX_VALUE, PRECISION, PRECISION_DEG } from '../constants.js';
import { _Math } from '../math/Math.js';
import { V3 } from '../math/V3.js';
import { Bone3D } from './Bone3D.js';
import { Joint3D } from './Joint3D.js';
import { Tools } from './Tools.js';

 function Chain3D ( color ){

    this.bones = [];
    this.name = '';
    this.color = color || 0xFFFFFF;

    this.mSolveDistanceThreshold = 1.0;
    this.mMaxIterationAttempts = 20;
    this.mMinIterationChange = 0.01;

    this.mChainLength = 0;
    this.mNumBones = 0;

    this.mFixedBaseLocation = new V3();
    this.mFixedBaseMode = true;

    this.mBaseboneConstraintType = NONE;

    this.mBaseboneConstraintUV = new V3();
    this.mBaseboneRelativeConstraintUV = new V3();
    this.mBaseboneRelativeReferenceConstraintUV = new V3();
    this.mLastTargetLocation = new V3( MAX_VALUE, MAX_VALUE, MAX_VALUE );

    this.mLastBaseLocation =  new V3( MAX_VALUE, MAX_VALUE, MAX_VALUE );
    this.mCurrentSolveDistance = MAX_VALUE;
    this.mConnectedChainNumber = -1;
    this.mConnectedBoneNumber = -1;

    

    this.mEmbeddedTarget = new V3();
    this.mUseEmbeddedTarget = false;

}

Object.assign( Chain3D.prototype, {

    isChain3D: true,

    clone:function(){

        var c = new Chain3D();

        c.bones = this.cloneIkChain();
        c.mFixedBaseLocation.copy( this.mFixedBaseLocation );
        c.mLastTargetLocation.copy( this.mLastTargetLocation );
        c.mLastBaseLocation.copy( this.mLastBaseLocation );
                
        // Copy the basebone constraint UV if there is one to copy
        if ( !(this.mBaseboneConstraintType === NONE) ){
            c.mBaseboneConstraintUV.copy( this.mBaseboneConstraintUV );
            c.mBaseboneRelativeConstraintUV.copy( this.mBaseboneRelativeConstraintUV );
        }       
        
        // Native copy by value for primitive members
        c.mChainLength            = this.mChainLength;
        c.mNumBones               = this.mNumBones;
        c.mCurrentSolveDistance   = this.mCurrentSolveDistance;
        c.mConnectedChainNumber   = this.mConnectedChainNumber;
        c.mConnectedBoneNumber    = this.mConnectedBoneNumber;
        c.mBaseboneConstraintType = this.mBaseboneConstraintType;

        c.color = this.color;

        return c;

    },

    clear:function(){

        var i = this.mNumBones;
        while(i--){
            this.removeBone(i);
        }

        this.mNumBones = 0;

    },

    addBone: function( bone ){

        bone.setColor( this.color );

        // Add the new bone to the end of the ArrayList of bones
        this.bones.push( bone );
        // Increment the number of bones in the chain and update the chain length
        this.mNumBones ++;

        // If this is the basebone...
        if ( this.mNumBones === 1 ){
            // ...then keep a copy of the fixed start location...
            this.mFixedBaseLocation.copy( bone.getStartLocation() );//.clone();
            
            // ...and set the basebone constraint UV to be around the initial bone direction
            this.mBaseboneConstraintUV.copy( bone.getDirectionUV() );
        }
        
        // Increment the number of bones in the chain and update the chain length
        this.updateChainLength();

    },

    removeBone:function( id ){
        if ( id < this.mNumBones ){   
            // ...then remove the bone, decrease the bone count and update the chain length.
            this.bones.splice(id, 1)
            this.mNumBones --;
            this.updateChainLength();
        }
    },

    addConsecutiveBone : function( directionUV, length ){
         //this.addConsecutiveBone( directionUV, length )
         if (this.mNumBones > 0) {               
            // Get the end location of the last bone, which will be used as the start location of the new bone
            var prevBoneEnd = this.bones[this.mNumBones-1].getEndLocation();//.clone();
                
            // Add a bone to the end of this IK chain
            // Note: We use a normalised version of the bone direction
            this.addBone( new Bone3D( prevBoneEnd, undefined, directionUV.normalised(), length ) );
        }

    },

    addConsecutiveFreelyRotatingHingedBone : function ( directionUV, length, type, hingeRotationAxis ){

        this.addConsecutiveHingedBone( directionUV, length, type, hingeRotationAxis, 180, 180, _Math.genPerpendicularVectorQuick( hingeRotationAxis ) );

    },

    addConsecutiveHingedBone: function( DirectionUV, length, type, HingeRotationAxis, clockwiseDegs, anticlockwiseDegs, hingeReferenceAxis ){

        // Cannot add a consectuive bone of any kind if the there is no basebone
        if ( this.mNumBones === 0 ) return;

        // Normalise the direction and hinge rotation axis 
        var directionUV = DirectionUV.normalised();
        var hingeRotationAxis = HingeRotationAxis.normalised();
            
        // Get the end location of the last bone, which will be used as the start location of the new bone
        var prevBoneEnd = this.bones[this.mNumBones-1].getEndLocation().clone();
            
        // Create a bone
        var bone = new Bone3D( prevBoneEnd, undefined, directionUV, length, this.color );

        type = type || 'global';

        bone.getJoint().setHinge( type === 'global' ? J_GLOBAL : J_LOCAL, hingeRotationAxis, clockwiseDegs, anticlockwiseDegs, hingeReferenceAxis );
        
        // ...then create and set up a joint which we'll apply to that bone.
        /*var joint = new Joint3D();

        switch (type){
            case 'global':
                joint.setAsGlobalHinge( hingeRotationAxis, clockwiseDegs, anticlockwiseDegs, hingeReferenceAxis );
                break;
            case 'local':
                joint.setAsLocalHinge( hingeRotationAxis, clockwiseDegs, anticlockwiseDegs, hingeReferenceAxis );
                break;

        }
        
        // Set the joint we just set up on the the new bone we just created
        bone.setJoint( joint );*/
        
        // Finally, add the bone to this chain
        this.addBone( bone );

    },

    addConsecutiveRotorConstrainedBone:function( boneDirectionUV, length, constraintAngleDegs ){

        if (this.mNumBones === 0) return;

        // Create the bone starting at the end of the previous bone, set its direction, constraint angle and colour
        // then add it to the chain. Note: The default joint type of a new Bone is J_BALL.
        boneDirectionUV = boneDirectionUV.normalised();
        var bone = new Bone3D( this.bones[ this.mNumBones-1 ].getEndLocation(), undefined , boneDirectionUV, length );
        bone.getJoint().setAsBallJoint( constraintAngleDegs );
        //bone.setBallJointConstraintDegs( constraintAngleDegs );
        this.addBone( bone );

    },

    // Connect this chain to the specified bone in the specified chain in the provided structure.

    connectToStructure : function( structure, chainNumber, boneNumber ){

        // Sanity check chain exists
        var numChains = structure.getNumChains();
        if (chainNumber > numChains) return;//{ throw new IllegalArgumentException("Structure does not contain a chain " + chainNumber + " - it has " + numChains + " chains."); }
        
        // Sanity check bone exists
        var numBones = structure.getChain( chainNumber ).getNumBones();
        if ( boneNumber > numBones ) return;//{ throw new IllegalArgumentException("Chain does not contain a bone " + boneNumber + " - it has " + numBones + " bones."); }
        
        // All good? Set the connection details
        this.mConnectedChainNumber = chainNumber;
        this.mConnectedBoneNumber  = boneNumber; 

    },

    // -------------------------------
    //      GET
    // -------------------------------

    getBaseboneConstraintType:function(){
        return this.mBaseboneConstraintType;
    },
    getBaseboneConstraintUV:function(){
        if ( !(this.mBaseboneConstraintType === NONE) ) return this.mBaseboneConstraintUV;
    },
    getBaseLocation:function(){
        return this.bones[0].getStartLocation();
    },
    getBone:function(id){
        return this.bones[id];
    },
    getChain:function(){
        return this.bones;
    },
    getChainLength:function(){
        return this.mChainLength;
    },
    getConnectedBoneNumber:function(){
        return this.mConnectedBoneNumber;
    },
    getConnectedChainNumber:function(){
        return this.mConnectedChainNumber;
    },
    getEffectorLocation:function(){
        return this.bones[this.mNumBones-1].getEndLocation();
    },
    getLastTargetLocation:function(){
        return this.mLastTargetLocation;
    },
    getLiveChainLength:function(){
        var lng = 0;        
        for (var i = 0; i < this.mNumBones; i++){  
            lng += this.bones[i].liveLength();
        }       
        return lng;
    },
    getName:function(){
        return this.name;
    },
    getNumBones: function () {
        return this.mNumBones;
    },

    getBaseboneRelativeReferenceConstraintUV: function () {
        return this.mBaseboneRelativeReferenceConstraintUV;
    },

    // -------------------------------
    //      SET
    // -------------------------------

    setColor:function(c){
        this.color = c;
        for (var i = 0; i < this.mNumBones; i++){  
            this.bones[i].setColor( c );
        }
        
    },

    setBaseboneRelativeConstraintUV: function( constraintUV ){ this.mBaseboneRelativeConstraintUV = constraintUV; },
    setBaseboneRelativeReferenceConstraintUV: function( constraintUV ){ this.mBaseboneRelativeReferenceConstraintUV = constraintUV; },

    setRotorBaseboneConstraint : function( type, constraintAxis, angleDegs ){

        // Sanity checking
        if (this.mNumBones === 0){ Tools.error("Chain must contain a basebone before we can specify the basebone constraint type."); return; }     
        if ( !(constraintAxis.length() > 0) ){ Tools.error("Constraint axis cannot be zero."); return;}

        type = type || 'global';       
        // Set the constraint type, axis and angle
        this.mBaseboneConstraintType = type === 'global' ? GLOBAL_ROTOR : LOCAL_ROTOR;
        this.mBaseboneConstraintUV = constraintAxis.normalised();
        this.mBaseboneRelativeConstraintUV.copy( this.mBaseboneConstraintUV );
        this.getBone(0).getJoint().setAsBallJoint( angleDegs );

    },

    setHingeBaseboneConstraint : function( type, hingeRotationAxis, cwConstraintDegs, acwConstraintDegs, hingeReferenceAxis ){

        // Sanity checking
        if ( this.mNumBones === 0){ Tools.error("Chain must contain a basebone before we can specify the basebone constraint type."); return; }   
        if ( hingeRotationAxis.length() <= 0 ){ Tools.error("Hinge rotation axis cannot be zero."); return;  }          
        if ( hingeReferenceAxis.length() <= 0 ){ Tools.error("Hinge reference axis cannot be zero."); return; }     
        if ( !( _Math.perpendicular( hingeRotationAxis, hingeReferenceAxis ) ) ){ Tools.error("The hinge reference axis must be in the plane of the hinge rotation axis, that is, they must be perpendicular."); return;}
        //if ( !(hingeType === GLOBAL_HINGE || hingeType === LOCAL_HINGE) ) return;//throw new IllegalArgumentException("The only valid hinge types for this method are GLOBAL_HINGE and LOCAL_HINGE.");
        
        type = type || 'global';

        // Set the constraint type, axis and angle
        this.mBaseboneConstraintType = type === 'global' ? GLOBAL_HINGE : LOCAL_HINGE;
        this.mBaseboneConstraintUV.copy( hingeRotationAxis.normalised() );
        
        var hinge = new Joint3D();
        
        //if ( type === 'global' ) hinge.setHinge( J_GLOBAL, hingeRotationAxis, cwConstraintDegs, acwConstraintDegs, hingeReferenceAxis );
        //else hinge.setHinge( J_LOCAL, hingeRotationAxis, cwConstraintDegs, acwConstraintDegs, hingeReferenceAxis );
        
        //this.getBone(0).setJoint( hinge );
        this.getBone(0).getJoint().setHinge( type === 'global' ? J_GLOBAL : J_LOCAL, hingeRotationAxis, cwConstraintDegs, acwConstraintDegs, hingeReferenceAxis );

    },

    setFreelyRotatingGlobalHingedBasebone : function( hingeRotationAxis ){

        this.setHingeBaseboneConstraint( 'global', hingeRotationAxis, 180, 180, _Math.genPerpendicularVectorQuick( hingeRotationAxis ) );
    },

    setGlobalHingedBasebone : function( hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis ){

        this.setHingeBaseboneConstraint( 'global', hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis );
    },

    setFreelyRotatingLocalHingedBasebone : function( hingeRotationAxis ){

        this.setHingeBaseboneConstraint( 'local', hingeRotationAxis, 180, 180, _Math.genPerpendicularVectorQuick( hingeRotationAxis ) );
    },

    setLocalHingedBasebone : function( hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis ){

        this.setHingeBaseboneConstraint( 'local', hingeRotationAxis, cwDegs, acwDegs, hingeReferenceAxis );
    },

    

    setBaseboneConstraintUV : function( constraintUV ){

        if ( this.mBaseboneConstraintType === NONE ) return;

        this.constraintUV.normalize();
        this.mBaseboneConstraintUV.copy( constraintUV );

    },

    setBaseLocation : function( baseLocation ){

        this.mFixedBaseLocation.copy( baseLocation );
    },

    setChain : function( bones ){

        //this.bones = bones;

        this.bones = [];
        var lng = bones.length;
        for(var i = 0; i< lng; i++){
            this.bones[i] = bones[i];
        }

    },

    

    setFixedBaseMode : function( value ){

        // Enforce that a chain connected to another chain stays in fixed base mode (i.e. it moves with the chain it's connected to instead of independently)
        if ( !value && this.mConnectedChainNumber !== -1) return;
        if ( this.mBaseboneConstraintType === GLOBAL_ROTOR && !value ) return;
        // Above conditions met? Set the fixedBaseMode
        this.mFixedBaseMode = value;
    },

    setMaxIterationAttempts : function( maxIterations ){

        if (maxIterations < 1) return;
        this.mMaxIterationAttempts = maxIterations;

    },

    setMinIterationChange : function( minIterationChange ){

        if (minIterationChange < 0) return;
        this.mMinIterationChange = minIterationChange;

    },

    setSolveDistanceThreshold : function( solveDistance ){

        if (solveDistance < 0) return;
        this.mSolveDistanceThreshold = solveDistance;

    },



    // -------------------------------
    //
    //      UPDATE TARGET
    //
    // -------------------------------

    resetTarget : function( ){
        this.mLastBaseLocation = new V3( MAX_VALUE, MAX_VALUE, MAX_VALUE );
        this.mCurrentSolveDistance = MAX_VALUE;
    },


    // Method to solve this IK chain for the given target location.
    // The end result of running this method is that the IK chain configuration is updated.

    // To minimuse CPU usage, this method dynamically aborts if:
    // - The solve distance (i.e. distance between the end effector and the target) is below the mSolveDistanceThreshold,
    // - A solution incrementally improves on the previous solution by less than the mMinIterationChange, or
    // - The number of attempts to solve the IK chain exceeds the mMaxIterationAttempts.

    updateTarget : function( t ){

        var newTarget = new V3( t.x, t.y, t.z );//.copy(t);//( newTarget.x, newTarget.y, newTarget.z );
        // If we have both the same target and base location as the last run then do not solve
        if ( this.mLastTargetLocation.approximatelyEquals( newTarget, 0.001) && this.mLastBaseLocation.approximatelyEquals( this.getBaseLocation(), 0.001) ) return this.mCurrentSolveDistance;
        
        /*
         * NOTE: We must allow the best solution of THIS run to be used for a new target or base location - we cannot
         * just use the last solution (even if it's better) - because that solution was for a different target / base
         * location combination and NOT for the current setup.
         */
                        
        // Declare a list of bones to use to store our best solution
        var bestSolution = [];
        
        // We start with a best solve distance that can be easily beaten
        var bestSolveDistance = MAX_VALUE;
        
        // We'll also keep track of the solve distance from the last pass
        var lastPassSolveDistance = MAX_VALUE;
        
        // Allow up to our iteration limit attempts at solving the chain
        var solveDistance;

        var i = this.mMaxIterationAttempts;
        while( i-- ){
        //for ( var i = 0; i < this.mMaxIterationAttempts; i++ ){   

            // Solve the chain for this target
            solveDistance = this.solveIK( newTarget );
            
            // Did we solve it for distance? If so, update our best distance and best solution, and also
            // update our last pass solve distance. Note: We will ALWAYS beat our last solve distance on the first run. 
            if ( solveDistance < bestSolveDistance ) {   

                bestSolveDistance = solveDistance;
                bestSolution = this.cloneIkChain();
                
                // If we are happy that this solution meets our distance requirements then we can exit the loop now
                if ( solveDistance <= this.mSolveDistanceThreshold ) break;
                
            } else {// Did not solve to our satisfaction? Okay...
            
                // Did we grind to a halt? If so break out of loop to set the best distance and solution that we have
                if ( Math.abs( solveDistance - lastPassSolveDistance ) < this.mMinIterationChange )  break; //System.out.println("Ground to halt on iteration: " + loop);

            }
            
            // Update the last pass solve distance
            lastPassSolveDistance = solveDistance;
            
        } // End of loop
        
        // Update our solve distance and chain configuration to the best solution found
        this.mCurrentSolveDistance = bestSolveDistance;
        this.bones = bestSolution;

        //console.log('dddddd' , this.bones )
        
        // Update our base and target locations
        this.mLastBaseLocation.copy( this.getBaseLocation() );
        this.mLastTargetLocation.copy( newTarget );
        
        return this.mCurrentSolveDistance;
        
    },

    // -------------------------------
    //
    //      SOLVE IK
    //
    // -------------------------------

    // Solve the IK chain for the given target using the FABRIK algorithm.
    // retun the best solve distance found between the end-effector of this chain and the provided target.

    solveIK : function( target ){

        if ( this.mNumBones === 0 ) return;

        var bone, boneLength, joint, jointType;
        var tmpMtx = new FIK.M3();
        
        // ---------- Forward pass from end effector to base -----------

        // Loop over all bones in the chain, from the end effector (numBones-1) back to the basebone (0) 
        var i = this.mNumBones;
        while( i-- ){


            // Get the length of the bone we're working on
            bone = this.bones[i];
            boneLength  = bone.length();
            joint = bone.getJoint();
            jointType = bone.getJointType();

            // If we are NOT working on the end effector bone
            if ( i !== this.mNumBones - 1 ) {
                // Get the outer-to-inner unit vector of the bone further out
                var outerBoneOuterToInnerUV = this.bones[ i+1 ].getDirectionUV().negated();

                // Get the outer-to-inner unit vector of this bone
                var boneOuterToInnerUV = bone.getDirectionUV().negated();
                
                // Get the joint type for this bone and handle constraints on boneInnerToOuterUV
                
                if ( jointType === J_BALL ) { 

                    // Constrain to relative angle between this bone and the outer bone if required
                    var angleBetweenDegs    = _Math.getAngleBetweenDegs( outerBoneOuterToInnerUV, boneOuterToInnerUV );
                    var constraintAngleDegs = joint.getBallJointConstraintDegs();
                    if ( angleBetweenDegs > constraintAngleDegs ){   
                        boneOuterToInnerUV = tmpMtx.getAngleLimitedUnitVectorDegs( boneOuterToInnerUV, outerBoneOuterToInnerUV, constraintAngleDegs );
                    }
                }
                else if ( jointType === J_GLOBAL ) {  

                    // Project this bone outer-to-inner direction onto the hinge rotation axis
                    // Note: The returned vector is normalised.
                    boneOuterToInnerUV = boneOuterToInnerUV.projectOnPlane( joint.getHingeRotationAxis() )//.normalize(); 
                    
                    // NOTE: Constraining about the hinge reference axis on this forward pass leads to poor solutions... so we won't.
                }
                else if ( jointType === J_LOCAL ) {   
                    // Not a basebone? Then construct a rotation matrix based on the previous bones inner-to-to-inner direction...
                    
                    var relativeHingeRotationAxis; // V3
                    if ( i > 0 ) {
                        tmpMtx.createRotationMatrix( this.bones[i-1].getDirectionUV() );
                        relativeHingeRotationAxis = tmpMtx.times( joint.getHingeRotationAxis() ).normalize();
                    } else {// ...basebone? Need to construct matrix from the relative constraint UV.
                        relativeHingeRotationAxis = this.mBaseboneRelativeConstraintUV.clone();
                    }
                    
                    // ...and transform the hinge rotation axis into the previous bones frame of reference.

                    // Project this bone's outer-to-inner direction onto the plane described by the relative hinge rotation axis
                    // Note: The returned vector is normalised.                 
                    boneOuterToInnerUV = boneOuterToInnerUV.projectOnPlane( relativeHingeRotationAxis );//.normalize();
                                        
                    // NOTE: Constraining about the hinge reference axis on this forward pass leads to poor solutions... so we won't.                                       
                }
                    
                // At this stage we have a outer-to-inner unit vector for this bone which is within our constraints,
                // so we can set the new inner joint location to be the end joint location of this bone plus the
                // outer-to-inner direction unit vector multiplied by the length of the bone.
                var newStartLocation = bone.getEndLocation().plus( boneOuterToInnerUV.times( boneLength ) );

                // Set the new start joint location for this bone
                bone.setStartLocation( newStartLocation );

                // If we are not working on the basebone, then we also set the end joint location of
                // the previous bone in the chain (i.e. the bone closer to the base) to be the new
                // start joint location of this bone.
                if (i > 0) this.bones[i-1].setEndLocation( newStartLocation );
                
            } else { // If we ARE working on the end effector bone...
            
                // Snap the end effector's end location to the target
                bone.setEndLocation( target );
                
                // Get the UV between the target / end-location (which are now the same) and the start location of this bone
                var boneOuterToInnerUV = bone.getDirectionUV().negated();
                
                // If the end effector is global hinged then we have to snap to it, then keep that
                // resulting outer-to-inner UV in the plane of the hinge rotation axis
                switch ( jointType ) {
                    case J_BALL:
                        // Ball joints do not get constrained on this forward pass
                    break;                      
                    case J_GLOBAL:
                        // Global hinges get constrained to the hinge rotation axis, but not the reference axis within the hinge plane
                        boneOuterToInnerUV = boneOuterToInnerUV.projectOnPlane( joint.getHingeRotationAxis() )//.normalize();
                    break;
                    case J_LOCAL:
                        // Local hinges get constrained to the hinge rotation axis, but not the reference axis within the hinge plane
                        
                        // Construct a rotation matrix based on the previous bones inner-to-to-inner direction...
                        tmpMtx.createRotationMatrix( this.bones[i-1].getDirectionUV() );
                        
                        // ...and transform the hinge rotation axis into the previous bones frame of reference.
                        var relativeHingeRotationAxis = tmpMtx.times( joint.getHingeRotationAxis() ).normalize();
                                            
                        // Project this bone's outer-to-inner direction onto the plane described by the relative hinge rotation axis
                        // Note: The returned vector is normalised.                 
                        boneOuterToInnerUV = boneOuterToInnerUV.projectOnPlane( relativeHingeRotationAxis );//.normalize();
                    break;
                }
                                                
                // Calculate the new start joint location as the end joint location plus the outer-to-inner direction UV
                // multiplied by the length of the bone.
                var newStartLocation = target.plus( boneOuterToInnerUV.times( boneLength ) );
                
                // Set the new start joint location for this bone to be new start location...
                bone.setStartLocation( newStartLocation );

                // ...and set the end joint location of the bone further in to also be at the new start location (if there IS a bone
                // further in - this may be a single bone chain)
                if (i > 0) this.bones[i-1].setEndLocation( newStartLocation );
                
            }
            
        } // End of forward pass

        // ---------- Backward pass from base to end effector -----------
 
        for ( i = 0; i < this.mNumBones; i++ ){

            bone = this.bones[i];
            boneLength  = bone.length();

            // If we are not working on the basebone
            if ( i !== 0 ){
                // Get the inner-to-outer direction of this bone as well as the previous bone to use as a baseline
                var boneInnerToOuterUV = bone.getDirectionUV();
                var prevBoneInnerToOuterUV = this.bones[i-1].getDirectionUV();
                
                // Dealing with a ball joint?
                joint = bone.getJoint();
                jointType = joint.getJointType();

                if ( jointType === J_BALL ){                   
                    var angleBetweenDegs    = _Math.getAngleBetweenDegs( prevBoneInnerToOuterUV, boneInnerToOuterUV );
                    var constraintAngleDegs = joint.getBallJointConstraintDegs(); 
                    
                    // Keep this bone direction constrained within the rotor about the previous bone direction
                    if (angleBetweenDegs > constraintAngleDegs){
                        boneInnerToOuterUV = tmpMtx.getAngleLimitedUnitVectorDegs( boneInnerToOuterUV, prevBoneInnerToOuterUV, constraintAngleDegs );
                    }
                }
                else if ( jointType === J_GLOBAL ) {                   
                    // Get the hinge rotation axis and project our inner-to-outer UV onto it
                    var hingeRotationAxis  = joint.getHingeRotationAxis();
                    boneInnerToOuterUV = boneInnerToOuterUV.projectOnPlane(hingeRotationAxis);
                    
                    // If there are joint constraints, then we must honour them...
                    var cwConstraintDegs   = -joint.getHingeClockwiseConstraintDegs();
                    var acwConstraintDegs  =  joint.getHingeAnticlockwiseConstraintDegs();

                    if ( !( _Math.nearEquals( cwConstraintDegs, -MAX_DEGS, PRECISION ) ) && !( _Math.nearEquals( acwConstraintDegs, MAX_DEGS, PRECISION ) ) ) {

                        var hingeReferenceAxis = joint.getHingeReferenceAxis();
                        
                        // Get the signed angle (about the hinge rotation axis) between the hinge reference axis and the hinge-rotation aligned bone UV
                        // Note: ACW rotation is positive, CW rotation is negative.
                        var signedAngleDegs = _Math.getSignedAngleBetweenDegs( hingeReferenceAxis, boneInnerToOuterUV, hingeRotationAxis );
                        
                        // Make our bone inner-to-outer UV the hinge reference axis rotated by its maximum clockwise or anticlockwise rotation as required
                        if (signedAngleDegs > acwConstraintDegs) boneInnerToOuterUV = tmpMtx.rotateAboutAxisDegs( hingeReferenceAxis, acwConstraintDegs, hingeRotationAxis ).normalised();
                        else if (signedAngleDegs < cwConstraintDegs) boneInnerToOuterUV = tmpMtx.rotateAboutAxisDegs( hingeReferenceAxis, cwConstraintDegs, hingeRotationAxis ).normalised();
                        
                    }
                }
                else if ( jointType === J_LOCAL ){   
                    // Transform the hinge rotation axis to be relative to the previous bone in the chain
                    var hingeRotationAxis = joint.getHingeRotationAxis();
                    
                    // Construct a rotation matrix based on the previous bone's direction
                    tmpMtx.createRotationMatrix( prevBoneInnerToOuterUV );
                    
                    // Transform the hinge rotation axis into the previous bone's frame of reference
                    var relativeHingeRotationAxis  = tmpMtx.times( hingeRotationAxis ).normalize();
                    
                    
                    // Project this bone direction onto the plane described by the hinge rotation axis
                    // Note: The returned vector is normalised.
                    boneInnerToOuterUV = boneInnerToOuterUV.projectOnPlane( relativeHingeRotationAxis );
                    
                    // Constrain rotation about reference axis if required
                    var cwConstraintDegs  = -joint.getHingeClockwiseConstraintDegs();
                    var acwConstraintDegs =  joint.getHingeAnticlockwiseConstraintDegs();
                    if ( !( _Math.nearEquals( cwConstraintDegs, -MAX_DEGS, PRECISION ) ) && !( _Math.nearEquals( acwConstraintDegs, MAX_DEGS, PRECISION ) ) ) {

                        // Calc. the reference axis in local space
                        //Vec3f relativeHingeReferenceAxis = mBaseboneRelativeReferenceConstraintUV;//m.times( joint.getHingeReferenceAxis() ).normalise();
                        var relativeHingeReferenceAxis = tmpMtx.times( joint.getHingeReferenceAxis() ).normalize();
                        
                        // Get the signed angle (about the hinge rotation axis) between the hinge reference axis and the hinge-rotation aligned bone UV
                        // Note: ACW rotation is positive, CW rotation is negative.
                        var signedAngleDegs = _Math.getSignedAngleBetweenDegs( relativeHingeReferenceAxis, boneInnerToOuterUV, relativeHingeRotationAxis );
                        
                        // Make our bone inner-to-outer UV the hinge reference axis rotated by its maximum clockwise or anticlockwise rotation as required
                        if (signedAngleDegs > acwConstraintDegs) boneInnerToOuterUV = tmpMtx.rotateAboutAxisDegs( relativeHingeReferenceAxis, acwConstraintDegs, relativeHingeRotationAxis ).normalize();
                        else if (signedAngleDegs < cwConstraintDegs) boneInnerToOuterUV = tmpMtx.rotateAboutAxisDegs( relativeHingeReferenceAxis, cwConstraintDegs, relativeHingeRotationAxis ).normalize();                            
                        
                    }
                    
                } // End of local hinge section
                
                // At this stage we have a outer-to-inner unit vector for this bone which is within our constraints,
                // so we can set the new inner joint location to be the end joint location of this bone plus the
                // outer-to-inner direction unit vector multiplied by the length of the bone.
                var newEndLocation = bone.getStartLocation().plus( boneInnerToOuterUV.times( boneLength ) );

                // Set the new start joint location for this bone
                bone.setEndLocation( newEndLocation );

                // If we are not working on the end effector bone, then we set the start joint location of the next bone in
                // the chain (i.e. the bone closer to the target) to be the new end joint location of this bone.
                if (i < (this.mNumBones - 1)) { this.bones[i+1].setStartLocation( newEndLocation ); }

            } else { // If we ARE working on the basebone...
               
                // If the base location is fixed then snap the start location of the basebone back to the fixed base...
                if ( this.mFixedBaseMode ){
                    bone.setStartLocation( this.mFixedBaseLocation );
                } else { // ...otherwise project it backwards from the end to the start by its length.
                
                    bone.setStartLocation( bone.getEndLocation().minus( bone.getDirectionUV().times( boneLength ) ) );
                }
                
                // If the basebone is unconstrained then process it as usual...
                if ( this.mBaseboneConstraintType === NONE ) {
                    // Set the new end location of this bone, and if there are more bones,
                    // then set the start location of the next bone to be the end location of this bone
                    var newEndLocation = bone.getStartLocation().plus( bone.getDirectionUV().times( boneLength ) );
                    bone.setEndLocation( newEndLocation );    
                    
                    if ( this.mNumBones > 1 ) { this.bones[1].setStartLocation( newEndLocation ); }
                } else {// ...otherwise we must constrain it to the basebone constraint unit vector
                  
                    if ( this.mBaseboneConstraintType === GLOBAL_ROTOR ){   
                        // Get the inner-to-outer direction of this bone
                        var boneInnerToOuterUV = bone.getDirectionUV();
                                
                        var angleBetweenDegs    = _Math.getAngleBetweenDegs( this.mBaseboneConstraintUV, boneInnerToOuterUV );
                        var constraintAngleDegs = bone.getBallJointConstraintDegs(); 
                    
                        if ( angleBetweenDegs > constraintAngleDegs ){
                            boneInnerToOuterUV = tmpMtx.getAngleLimitedUnitVectorDegs( boneInnerToOuterUV, this.mBaseboneConstraintUV, constraintAngleDegs );
                        }
                        
                        var newEndLocation = bone.getStartLocation().plus( boneInnerToOuterUV.times( boneLength ) );
                        
                        bone.setEndLocation( newEndLocation );
                        
                        // Also, set the start location of the next bone to be the end location of this bone
                        if ( this.mNumBones > 1 ) { this.bones[1].setStartLocation( newEndLocation ); }
                    }
                    else if ( this.mBaseboneConstraintType === LOCAL_ROTOR ){
                        // Note: The mBaseboneRelativeConstraintUV is updated in the Structure.updateTarget()
                        // method BEFORE this Chain.updateTarget() method is called. We no knowledge of the
                        // direction of the bone we're connected to in another chain and so cannot calculate this 
                        // relative basebone constraint direction on our own, but the Structure does it for
                        // us so we are now free to use it here.
                        
                        // Get the inner-to-outer direction of this bone
                        var boneInnerToOuterUV = bone.getDirectionUV();
                                
                        // Constrain about the relative basebone constraint unit vector as neccessary
                        var angleBetweenDegs    = _Math.getAngleBetweenDegs( this.mBaseboneRelativeConstraintUV, boneInnerToOuterUV);
                        var constraintAngleDegs = bone.getBallJointConstraintDegs();
                        if ( angleBetweenDegs > constraintAngleDegs ){
                            boneInnerToOuterUV = tmpMtx.getAngleLimitedUnitVectorDegs(boneInnerToOuterUV, this.mBaseboneRelativeConstraintUV, constraintAngleDegs);
                        }
                        
                        // Set the end location
                        var newEndLocation = bone.getStartLocation().plus( boneInnerToOuterUV.times( boneLength ) );                        
                        bone.setEndLocation( newEndLocation );
                        
                        // Also, set the start location of the next bone to be the end location of this bone
                        if ( this.mNumBones > 1 ) { this.bones[1].setStartLocation(newEndLocation); }

                    } else if ( this.mBaseboneConstraintType === GLOBAL_HINGE ) {

                        joint = bone.getJoint();
                        var hingeRotationAxis  =  joint.getHingeRotationAxis();
                        var cwConstraintDegs   = - joint.getHingeClockwiseConstraintDegs(); // Clockwise rotation is negative!
                        var acwConstraintDegs  =  joint.getHingeAnticlockwiseConstraintDegs();
                        
                        // Get the inner-to-outer direction of this bone and project it onto the global hinge rotation axis
                        var boneInnerToOuterUV = bone.getDirectionUV().projectOnPlane( hingeRotationAxis ).normalize();
                                
                        // If we have a global hinge which is not freely rotating then we must constrain about the reference axis
                        if ( !( _Math.nearEquals( cwConstraintDegs, -MAX_DEGS, PRECISION_DEG ) ) && !( _Math.nearEquals( acwConstraintDegs, MAX_DEGS, PRECISION_DEG ) ) ) {

                            // Grab the hinge reference axis and calculate the current signed angle between it and our bone direction (about the hinge
                            // rotation axis). Note: ACW rotation is positive, CW rotation is negative.
                            var hingeReferenceAxis = joint.getHingeReferenceAxis();
                            var signedAngleDegs    = _Math.getSignedAngleBetweenDegs( hingeReferenceAxis, boneInnerToOuterUV, hingeRotationAxis );
                            
                            // Constrain as necessary
                            if (signedAngleDegs > acwConstraintDegs) boneInnerToOuterUV = tmpMtx.rotateAboutAxisDegs( hingeReferenceAxis, acwConstraintDegs, hingeRotationAxis ).normalize();
                            else if (signedAngleDegs < cwConstraintDegs) boneInnerToOuterUV = tmpMtx.rotateAboutAxisDegs( hingeReferenceAxis, cwConstraintDegs, hingeRotationAxis ).normalize();                            
                            
                        }
                        
                        // Calc and set the end location of this bone
                        var newEndLocation = bone.getStartLocation().plus( boneInnerToOuterUV.times( boneLength ) );                        
                        bone.setEndLocation( newEndLocation );
                        
                        // Also, set the start location of the next bone to be the end location of this bone
                        if ( this.mNumBones > 1 ) { this.bones[1].setStartLocation(newEndLocation); }

                    } else if ( this.mBaseboneConstraintType === LOCAL_HINGE ){

                        joint = bone.getJoint();
                        var hingeRotationAxis  =  this.mBaseboneRelativeConstraintUV;          // Basebone relative constraint is our hinge rotation axis!
                        var cwConstraintDegs   = - joint.getHingeClockwiseConstraintDegs();    // Clockwise rotation is negative!
                        var acwConstraintDegs  =  joint.getHingeAnticlockwiseConstraintDegs();
                        
                        // Get the inner-to-outer direction of this bone and project it onto the global hinge rotation axis
                        var boneInnerToOuterUV = bone.getDirectionUV().projectOnPlane(hingeRotationAxis);
                        
                        //If we have a local hinge which is not freely rotating then we must constrain about the reference axis
                        if ( !( _Math.nearEquals( cwConstraintDegs, -MAX_DEGS, PRECISION_DEG ) ) && !( _Math.nearEquals( acwConstraintDegs, MAX_DEGS, PRECISION_DEG ) ) ) {
        
                            // Grab the hinge reference axis and calculate the current signed angle between it and our bone direction (about the hinge
                            // rotation axis). Note: ACW rotation is positive, CW rotation is negative.
                            var hingeReferenceAxis = this.mBaseboneRelativeReferenceConstraintUV; //joint.getHingeReferenceAxis();
                            var signedAngleDegs    = _Math.getSignedAngleBetweenDegs( hingeReferenceAxis, boneInnerToOuterUV, hingeRotationAxis );
                            
                            // Constrain as necessary
                            if ( signedAngleDegs > acwConstraintDegs ) boneInnerToOuterUV = tmpMtx.rotateAboutAxisDegs( hingeReferenceAxis, acwConstraintDegs, hingeRotationAxis ).normalize();
                            else if (signedAngleDegs < cwConstraintDegs) boneInnerToOuterUV = tmpMtx.rotateAboutAxisDegs( hingeReferenceAxis, cwConstraintDegs, hingeRotationAxis ).normalize();   

                        }
                        
                        // Calc and set the end location of this bone
                        var newEndLocation = bone.getStartLocation().plus( boneInnerToOuterUV.times( boneLength ) );                        
                        bone.setEndLocation( newEndLocation );
                        
                        // Also, set the start location of the next bone to be the end location of this bone
                        if ( this.mNumBones > 1 ) { this.bones[1].setStartLocation( newEndLocation ); }
                    }
                    
                } // End of basebone constraint handling section

            } // End of basebone handling section

        } // End of backward-pass i over all bones

        // Update our last target location
        this.mLastTargetLocation.copy( target );
                
        // DEBUG - check the live chain length and the originally calculated chain length are the same
        /*
        if (Math.abs( this.getLiveChainLength() - mChainLength) > 0.01f)
        {
            System.out.println("Chain length off by > 0.01f");
        }
        */

        
        // Finally, calculate and return the distance between the current effector location and the target.
        return _Math.distanceBetween( this.bones[this.mNumBones-1].getEndLocation(), target );

    },

    updateChainLength: function () {

        // Loop over all the bones in the chain, adding the length of each bone to the mChainLength property
        this.mChainLength = 0;
        var i = this.mNumBones;
        while(i--) this.mChainLength += this.bones[i].length();

    },

    cloneIkChain: function () {

        // How many bones are in this chain?
        
        // Create a new Array
        var clonedChain = [];

        // For each bone in the chain being cloned...       
        for (var i = 0; i < this.mNumBones; i++){
            // Use the copy constructor to create a new Bone with the values set from the source Bone.
            // and add it to the cloned chain.
            clonedChain.push( this.bones[i].clone() );
        }
        
        return clonedChain;

    }


// end

} );

export { Chain3D };