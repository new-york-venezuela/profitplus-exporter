# SP: pv_ActualizarOrigenAJPA
**Tipo**: PV-Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pv_ActualizarAjustePositivoAutomatico
*DESCRIPCIÓN	:	Actualizar el origen del Ajuste Positivo Automatico
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarOrigenAJPA] 
    (
      @sNro_Doc		CHAR(20),
	  @sNro_Cob		CHAR(20),
      @sTipo_Doc	CHAR(6),
	  @sOrigen_AJPA	CHAR(6),
	  @sCo_Us_Mo	CHAR(6) ,
      @sCo_Sucu_Mo	CHAR(6)				=	NULL ,
      @sMaquina		VARCHAR(60)			=	NULL ,
      @sCampos		VARCHAR(MAX)		=	NULL ,
      @sRevisado	CHAR(1) ,
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

        UPDATE
            saDocumentoVenta
        SET 
			nro_orig = @sNro_Cob, doc_orig = @sOrigen_AJPA
		    OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            nro_doc = @sNro_Doc AND 
            co_tipo_doc = @sTipo_Doc

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
                    @sTablaOri = 'saDocumentoVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sNro_Doc
            END
	END
```
