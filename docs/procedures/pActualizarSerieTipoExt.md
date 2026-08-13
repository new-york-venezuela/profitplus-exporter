# SP: pActualizarSerieTipoExt
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			: [pActualizarSerieTipoExt]
*DESCRIPCIÓN	: ACTUALIZA LA INFORMACION DE LA SERIE NCF EN LA TABLA EXTENDIDA
*CREATEDATE     : <2019-04-05>
*AUTOR			: SOFTECH SISTEMAS
************************************************************************/ 
CREATE PROCEDURE [dbo].[pActualizarSerieTipoExt]
    (
		@gRowguid_serietipo	UNIQUEIDENTIFIER,
		@sCo_Serie		CHAR (1),
		@sCo_Negocio    CHAR (2),
		@sPunto_Emi     CHAR (3),
		@sArea_Imp      CHAR (3),
		@sCo_Tipo       CHAR (2),
		@sdFe_Venc      SMALLDATETIME, 
		@iNotiDiaVenc   INT,
		@iNotiFinSerie  INT,
		@sCo_Us_Mo		CHAR(6) ,
		@sCo_Sucu_Mo	CHAR(6)				=	NULL ,
		@sMaquina		VARCHAR(60)			=	NULL ,
		@sCampos		VARCHAR(MAX)		=	NULL ,
		@sRevisado		CHAR(1) ,
		@sTrasnfe		CHAR(1) ,
		@tsValidador	TIMESTAMP			=	NULL ,
		@gRowguid		UNIQUEIDENTIFIER	=	NULL 
    )
AS 
    BEGIN

		DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

		UPDATE saSerieTipoExt SET co_serie = @sCo_Serie, co_negocio = @sCo_Negocio, punto_emi = @sPunto_Emi,
		       area_imp = @sArea_Imp, co_tipo = @sCo_Tipo, fe_venc = @sdFe_Venc, notidiavenc = @iNotiDiaVenc,
			   notifinserie = @iNotiFinSerie,      
		       co_us_mo = @sCo_Us_Mo, fe_us_mo = GETDATE() 
			OUTPUT inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
				      INTO @TableTimestamp
		WHERE rowguid_serietipo = @gRowguid_serietipo 
	    
		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

		SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
			FROM
				@TableTimestamp

		   IF @dtFe_In IS NOT NULL 
            BEGIN
		        -- Insertar PistaS
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saSerieTipoExt', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sCampos
			END
    END
```
