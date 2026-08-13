# SP: pActualizarIncoterm
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saIncoterm`](../tables/saIncoterm.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarIncoterm
DESCRIPCION: Actualiza Tabla Incoterm
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarIncoterm]
    (
      @sCo_Incoterm CHAR(6) ,
      @sIncoterm_Des VARCHAR(60) ,
      @deSecuencia int ,
	  @bMaritimo bit ,
	  @bAereo bit ,
	  @bTerrestre bit ,
	  @sdescrip_detallada VARCHAR(MAX) = NULL,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 		
	
    )
AS 
    BEGIN  
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            ) ;
    
        UPDATE
            saIncoterm
        SET co_incoterm = @sCo_Incoterm, incoterm_des = @sIncoterm_Des, secuencia = @deSecuencia, maritimo = @bMaritimo, aereo = @bAereo, 
		    terrestre = @bTerrestre, descrip_detallada = @sdescrip_detallada,
		    campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            Inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_Incoterm = @sCo_Incoterm
            AND validador = @tsValidador
    
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInser
```
