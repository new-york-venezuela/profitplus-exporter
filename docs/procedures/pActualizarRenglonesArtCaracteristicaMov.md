# SP: pActualizarRenglonesArtCaracteristicaMov
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristicaMov`](../tables/saArtCaracteristicaMov.md)

## Código (excerpt)
```sql
/*******************************************************************************************************************
*NOMBRE			: [pActualizarRenglonesArtCaracteristicaMov]
*DESCRIPCIÓN	: Sp que oactualiza renglones de la llista de movimientos 
*AUTOR			: SOFTECH SISTEMAS
*******************************************************************************************************************/ 

CREATE PROCEDURE [dbo].[pActualizarRenglonesArtCaracteristicaMov]
    (
		@gRowguid				UNIQUEIDENTIFIER	= NULL,
		@iRENG_NUM				INT = 0,
		@iRENG_NUMOri			INT =0,
		@deCantidad				DECIMAL(18,5),
		@sCo_Us_Mo				CHAR(6) ,
		@sCo_Sucu_Mo			CHAR(6) ,
		@sMaquina				VARCHAR(60)			= NULL ,
		@sCampos				VARCHAR(MAX)		= NULL ,
		@sRevisado				CHAR(1)				= NULL ,
		@sTrasnfe				CHAR(1)				= NULL

	)

AS
BEGIN
	   DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
		UPDATE saArtCaracteristicaMov
		   SET 
			  cantidad	=	@deCantidad, revisado =@sRevisado,Trasnfe = @sTrasnfe, 
			  Co_Us_Mo = @sCo_Us_Mo, Co_Sucu_Mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE()
		OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
		 WHERE 
			  rowguid	=	@gRowguid
		
		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
	
        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saArtCaracteristicaMov', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M',
                    @sMaquina = @sMaquina, @sCampos = @sCampos
            END
	
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
