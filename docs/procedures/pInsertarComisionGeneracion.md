# SP: pInsertarComisionGeneracion
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saComisionGeneracion`](../tables/saComisionGeneracion.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pInsertarTablaComisionGeneracion
*DESCRIPCIÓN	:	Inserta un registro en la tabla  Comision Generacion
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pInsertarComisionGeneracion]
    (
      @sCo_Generacion CHAR(20) ,
      @dtFecha DATETIME,
      @sCo_Comi CHAR(6) ,     
      @sComentario VARCHAR(MAX) = NULL,
      @dtFecha_Desde DATETIME,
      @dtFecha_Hasta DATETIME,
      @sCo_Ven_Desde CHAR(6) = NULL,
      @sCo_Ven_Hasta CHAR(6) = NULL,
      @sTipo_Ven_Desde CHAR(4) = NULL,
      @sTipo_Ven_Hasta CHAR(4) = NULL,
      @sCo_Art_Desde CHAR(30) = NULL,
      @sCo_Art_Hasta CHAR(30) = NULL,
      @sCo_Cat_Desde CHAR(6) = NULL,
      @sCo_Cat_Hasta CHAR(6) = NULL,
      @sCo_Lin_Desde CHAR(6) = NULL,
      @sCo_Lin_Hasta CHAR(6) = NULL,
      @sP_Adicional VARCHAR(MAX) = NULL,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL
            
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
		
        INSERT  INTO saComisionGeneracion
                ( co_generacion, fecha, co_comi, comentario, fecha_desde, fecha_hasta, co_ven_desde, co_ven_hasta,
                 tipo_ven_desde, tipo_ven_hasta, co_art_desde, co_art_hasta, co_cat_desde, co_cat_hasta,
                 co_lin_desde, co_lin_hasta, p_adicional, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in,
                  co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Generacion, @dtFecha, @sCo_Comi, @sComentario, @dtFecha_Desde,  @dtFecha_Hasta,  @sCo_Ven_Desde, @sCo_Ven_Hasta,
                 @sTipo_Ven_Desd
```
