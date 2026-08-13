# SP: pInsertarRenglonesArtCaracteristicaMov
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristicaMov`](../tables/saArtCaracteristicaMov.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarRenglonesPrecioArticulo
*DESCRIPCIÓN	: Inserta un registro en la tabla ArtCaracteristicaMov cuando se da entrada
				  o salida una combinacion de sublineas a un articulo
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pInsertarRenglonesArtCaracteristicaMov]
    (
		@gRowGuidDoc	UNIQUEIDENTIFIER,
		@sCo_lin01		CHAR(6) ,
		@sCo_lin02		CHAR(6)			= NULL ,
		@sCo_lin03		CHAR(6)			= NULL ,
		@sCo_lin04		CHAR(6)			= NULL ,
		@sCo_lin05		CHAR(6)			= NULL ,
		@sCo_subl01		CHAR(6) ,
		@sCo_subl02		CHAR(6)			= NULL ,
		@sCo_subl03		CHAR(6)			= NULL ,
		@sCo_subl04		CHAR(6)			= NULL ,
		@sCo_subl05		CHAR(6)			= NULL ,
  		@deCantidad		DECIMAL(18,5),
		@sTipo_doc		CHAR(4) ,
		@iReng_Num		INT 			= NULL ,
		@sRevisado		CHAR(1)			= NULL ,
		@sTrasnfe		CHAR(1)			= NULL,
		@sCo_Us_In		CHAR(6) ,
		@sCo_Sucu_In	CHAR(6) ,
		@sMaquina		VARCHAR(60)		= NULL
	
    )
AS 
    BEGIN
		 DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
            
		INSERT INTO saArtCaracteristicaMov
           (
			   rowguid , rowguidDoc, tipo_doc ,co_lin01 ,co_subl01
			   ,co_lin02 ,co_subl02 ,co_lin03 ,co_subl03
			   ,co_lin04 ,co_subl04 ,co_lin05 ,co_subl05
			   ,cantidad ,co_us_in ,co_sucu_in ,fe_us_in
			   ,co_us_mo ,co_sucu_mo ,fe_us_mo ,revisado
			   ,trasnfe  
           )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
     VALUES
           (
				newid(), @gRowGuidDoc, @sTipo_doc, @sCo_lin01, @sCo_subl01,
				@sCo_lin02, @sCo_subl02, @sCo_lin03, @sCo_subl03,
				@sCo_lin04, @sCo_subl04, @sCo_lin05, @sCo_subl05, 
				@deCantidad,@sCo_Us_In, @sCo_Sucu_In, GETDATE(),
				@sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado,
				@sTrasnfe
           )
     DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saArtCaracteristicaMov', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
```
